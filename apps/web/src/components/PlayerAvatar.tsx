export function PlayerAvatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {avatarUrl ? <img src={avatarUrl} alt={name} /> : initial}
    </div>
  );
}
