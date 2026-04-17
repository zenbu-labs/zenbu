export function GreetingBadge({ text }: { text: string }) {
  return (
    <div
      style={{
        background: "#0f3460",
        borderRadius: 6,
        padding: "6px 14px",
        fontSize: 13,
        color: "#adf",
        display: "inline-block",
      }}
    >
      {text} — from <strong>@zenbu/ui hi</strong>
    </div>
  );
}
