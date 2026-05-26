package main

import (
	"sort"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// BenchmarkRequest represents the payload Python sends to Go
type BenchmarkRequest struct {
	SubmissionID string `json:"submission_id"`
	Endpoint     string `json:"endpoint"`
	Concurrency  int    `json:"concurrency"`
	DurationSec  int    `json:"duration_seconds"`
}

type BenchmarkResult struct{
	SubmissionID string            `json:"submission_id"`
	Total        uint64            `json:"total_requests"`
	Success      uint64            `json:"success"`
	Failures     uint64            `json:"failures"`
	TPS          float64           `json:"tps"`
	ErrorRate    float64           `json:"error_rate"`
	AvgLatencyMs float64           `json:"avg_latency_ms"`
	MinLatencyMs float64           `json:"min_latency_ms"`
	MaxLatencyMs float64           `json:"max_latency_ms"`
	P50LatencyMs float64           `json:"p50_latency_ms"`
	P90LatencyMs float64           `json:"p90_latency_ms"`
	P99LatencyMs float64           `json:"p99_latency_ms"`
	StatusCodes  map[int]uint64    `json:"status_codes"`
}

// Global, optimized HTTP client. Reuses TCP handshakes .
// This prevents running out of local ephemeral sockets (EMFILE / TIME_WAIT states) .
var httpClient = &http.Client{
	Transport: &http.Transport{
		MaxIdleConns:        20000,
		MaxIdleConnsPerHost: 5000,
		IdleConnTimeout:     90 * time.Second,
	},
	Timeout: 5 * time.Second,
}

func main() {
	http.HandleFunc("/benchmark", handleBenchmark)
	log.Println("Go Load Generator listening on :8001...")
	log.Fatal(http.ListenAndServe(":8001", nil))
}

func handleBenchmark(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req BenchmarkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Spin off the load testing in a non-blocking background Goroutine
	result := startStressTest(req.SubmissionID, req.Endpoint, req.Concurrency, time.Duration(req.DurationSec)*time.Second)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func startStressTest(subID, endpoint string, concurrency int, duration time.Duration) BenchmarkResult{
	log.Printf("[%s] Target initialized: %s | Bots: %d | Duration: %s", subID, endpoint, concurrency, duration)

	ctx, cancel := context.WithTimeout(context.Background(), duration)
	defer cancel()

	var successCount uint64
	var failCount uint64
	var wg sync.WaitGroup
	var collectorWg sync.WaitGroup

	latencyChan :=make(chan int64, 100000)
	statusCodes := sync.Map{}

	var latencies []int64

	collectorWg.Add(1)
	go func(){
		defer collectorWg.Done()

		for lat := range latencyChan{
			latencies=append(latencies, lat)
		}
	}()

	// Capture start timestamp
	startTime := time.Now()

	// Spawn the concurrent bot fleet
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(botID int) {
			defer wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				default:
					// Simulate sending limit or market orders [10]
					orderPayload := []byte(`{
						"order_type": "LIMIT",
						"side":"BUY",
						"price": 420.69,
						"quantity": 10
					}`)

					req, err := http.NewRequestWithContext(ctx, "POST", endpoint+"/order", bytes.NewBuffer(orderPayload))
					if err != nil {
						log.Println("Request failed:", err)
						atomic.AddUint64(&failCount, 1)
						continue
					}
					req.Header.Set("Content-Type", "application/json")

					requestStart := time.Now()
					resp, err := httpClient.Do(req)
					latencyNs := time.Since(requestStart).Nanoseconds()

					select{
					case latencyChan <- latencyNs:
					default:
					}
					if err != nil {
						if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || ctx.Err() != nil {
							return
						}
						log.Println("Request failed:", err)
						atomic.AddUint64(&failCount, 1)
						continue
					}

					code:= resp.StatusCode
					val, _ :=statusCodes.LoadOrStore(code, new(uint64))
					atomic.AddUint64(val.(*uint64),1)

					if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
						_, _ = io.Copy(io.Discard, resp.Body)
						resp.Body.Close()
						atomic.AddUint64(&successCount, 1)
					} else {
						body, _ := io.ReadAll(resp.Body)
						resp.Body.Close()

						log.Printf(
							"Bad response | status=%d | body=%s",
							resp.StatusCode,
							string(body),
						)

						atomic.AddUint64(&failCount, 1)
					}
				}
			}
		}(i)
	}

	// Wait for the duration timeout to trigger and all goroutines to exit cleanly
	wg.Wait()
	close(latencyChan)
	collectorWg.Wait()

	totalRequests := successCount + failCount
	elapsedSeconds := time.Since(startTime).Seconds()

	// Throughput calculation: T = N / t
	tps := float64(successCount) / elapsedSeconds

	sort.Slice(latencies, func(i, j int) bool {
		return latencies[i] < latencies[j]
	})

	var totalLatency int64
	for _, latency := range latencies {
		totalLatency += latency
	}

	avgLatencyMs := 0.0
	minLatencyMs := 0.0
	maxLatencyMs := 0.0

	if len(latencies) > 0 {
		avgLatencyMs = float64(totalLatency) / float64(len(latencies)) / 1e6
		minLatencyMs = float64(latencies[0]) / 1e6
		maxLatencyMs = float64(latencies[len(latencies)-1]) / 1e6
	}

	errorRate := 0.0
	if totalRequests > 0 {
		errorRate = float64(failCount) / float64(totalRequests) * 100
	}

	statusCodeMap := make(map[int]uint64)

	statusCodes.Range(func(key, value any) bool {
		statusCodeMap[key.(int)] = atomic.LoadUint64(value.(*uint64))
		return true
	})
	result := BenchmarkResult{
		SubmissionID: subID,
		Total:        totalRequests,
		Success:      successCount,
		Failures:     failCount,
		TPS:          tps,
		ErrorRate:    errorRate,
		AvgLatencyMs: avgLatencyMs,
		MinLatencyMs: minLatencyMs,
		MaxLatencyMs: maxLatencyMs,
		P50LatencyMs: percentile(latencies, 0.50),
		P90LatencyMs: percentile(latencies, 0.90),
		P99LatencyMs: percentile(latencies, 0.99),
		StatusCodes:  statusCodeMap,
	}

	pretty, _ := json.MarshalIndent(result, "", "  ")
	log.Println(string(pretty))
	return result
}

func percentile(sorted []int64, p float64) float64 {
	if len(sorted) == 0 {
		return 0
	}

	index := int(float64(len(sorted)-1) * p)
	return float64(sorted[index]) / 1e6
}