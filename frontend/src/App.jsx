import {useEffect, useState} from "react";
import "./App.css"

const API_BASE = "http://localhost:8000"
const WS_URL = "ws://localhost:8000/ws/leaderboard"

function App() {
  const [file, setFile] = useState(null);


  async function uploadSubmission(){
    if(!file) return;

    setUploading(true);

    const formData=new FormData();
    formData.append("file",file)
    const response=await fetch(`${API_BASE}/submit`, {
      method: "POST",
      body : formData,
  });
  const 
  
}