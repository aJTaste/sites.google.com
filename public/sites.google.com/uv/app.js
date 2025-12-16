const input = document.getElementById('url');
const iframe = document.getElementById('view');
const btn = document.getElementById('go');

btn.onclick = () => {
  const url = encodeURIComponent(input.value);
  iframe.src = `/proxy?url=${url}`;
};
