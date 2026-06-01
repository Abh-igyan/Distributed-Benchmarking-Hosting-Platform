import docker
import zipfile
import os
import asyncio
import docker.errors

class SandboxManager:
    def __init__(self):
        self.client = docker.from_env()
        self.containers={}

    async def build(self, submission_id, zip_path):
        extract_path=f"submissions/{submission_id}/code"

        await asyncio.to_thread(self._extract_zip, zip_path, extract_path)
        await asyncio.to_thread(self._ensure_dockerfile, extract_path)

        image_tag=f"submission-{submission_id}-latest"
        await self._build_image(extract_path,image_tag)

        self.containers.setdefault(submission_id, {})
        self.containers[submission_id]["image_tag"] = image_tag
        return image_tag

    async def run(self, submission_id, image_tag, purpose="run"):
        await asyncio.to_thread(self.stop_container, submission_id)

        def run_container():
            c=self.client.containers.run(
                image=image_tag,
                detach=True,
                runtime="runsc",
                name=f"sandbox-{submission_id[:8]}-{purpose}",

                cpuset_cpus="2,3",
                cpu_period=100000,
                cpu_quota=200000,

                mem_limit="512m",
                memswap_limit="512m",

                network_mode="bridge",

                read_only=True,
                tmpfs={"/tmp":"size=64m"},

                ports={"8080/tcp": None},

                security_opt=["no-new-privileges:true"],
            )
            c.reload()
            return c
        
        container= await asyncio.to_thread(run_container)
        if "8080/tcp" not in container.ports:
            raise Exception("Container did not expose 8080")
        else: host_port=container.ports["8080/tcp"][0]["HostPort"]
        endpoint=f"http://localhost:{host_port}"

        self.containers.setdefault(submission_id, {})
        self.containers[submission_id].update({
            "container": container,
            "endpoint": endpoint,
            "image_tag": image_tag,
            "purpose": purpose,
        })
        return endpoint

    async def deploy(self,submission_id, zip_path):
        image_tag = await self.build(submission_id, zip_path)
        return await self.run(submission_id, image_tag, purpose="initial")
    
    async def _build_image(self,context_path,tag):
        loop=asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: self.client.images.build(path=context_path, tag=tag, rm=True)
        )

    def get_status(self, submission_id: str):
        if submission_id not in self.containers:
            return None
            
        data = self.containers[submission_id]
        
        # 1. If it's still building (or failed), we don't have a Docker container object yet
        if "container" not in data:
            return {
                "submission_id": submission_id,
                "contestant_name": data.get("contestant_name"),
                "language": data.get("language"),
                "status": data.get("status", "unknown"),
                "endpoint": None,
                "result": data.get("result"),
                "error": data.get("error"),
            }
            
        # 2. Once the build finishes, it has a container object we can query
        container = data["container"]
        try:
            container.reload()
            current_status = container.status
        except docker.errors.NotFound:
            # Failsafe in case the container crashed and was removed
            current_status = "removed"
        
        return {
            "submission_id": submission_id,
            "contestant_name": data.get("contestant_name"),
            "language": data.get("language"),
            "status": data.get("status", current_status),
            "endpoint": data.get("endpoint") if current_status == "running" else None,
            "result": data.get("result"),
            "error": data.get("error"),
        }

    def stop_container(self, submission_id: str):
        if submission_id in self.containers:
            container = self.containers[submission_id].get("container")
            if container is not None:
                try:
                    container.stop()
                except docker.errors.APIError:
                    pass
                try:
                    container.remove()
                except (docker.errors.APIError, docker.errors.NotFound):
                    pass
            self.containers[submission_id].pop("container", None)
            self.containers[submission_id].pop("endpoint", None)
            self.containers[submission_id].pop("purpose", None)

    def delete_submission_record(self, submission_id: str):
        if submission_id in self.containers:
            del self.containers[submission_id]

    def _extract_zip(self, zip_path, extract_path):
        with zipfile.ZipFile(zip_path, 'r') as z:
            z.extractall(extract_path)

    def _ensure_dockerfile(self, extract_path):
        dockerfile_path = os.path.join(extract_path, "Dockerfile")
        
        if os.path.exists(dockerfile_path):
            return 
            
        files = os.listdir(extract_path)
        dockerfile_content = ""

        # Check for Python
        if any(f.endswith('.py') for f in files):
            # Dynamically grab the first .py file
            py_files = [f for f in files if f.endswith('.py')]
            entry_file = py_files[0]
            dockerfile_content = f"""FROM python:3.10-slim

WORKDIR /app
COPY . /app

RUN pip install fastapi uvicorn

EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
"""
        # Check for C++
        elif any(f.endswith('.cpp') for f in files):
            # Dynamically grab the first .cpp file
            cpp_files = [f for f in files if f.endswith('.cpp')]
            entry_file = cpp_files[0]
            dockerfile_content = f"""FROM gcc:latest
WORKDIR /app
COPY . /app
RUN g++ -O3 -o program {entry_file}
CMD ["./program"]
"""
        else:
            raise ValueError("Could not determine language. No .py or .cpp files found.")

        with open(dockerfile_path, "w") as f:
            f.write(dockerfile_content)
