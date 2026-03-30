async function getData() {
  const res = await fetch("/api/hello")
  const data = await res.json()

  document.getElementById("result").innerText = data.message
}