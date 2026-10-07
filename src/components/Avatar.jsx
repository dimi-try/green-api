function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export default function Avatar({ name }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();

  const hue = hashString(name) % 360;

  return (
    <div
      className="avatar"
      style={{ background: `hsl(${hue} 45% 42%)` }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
