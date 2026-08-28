export function timeAgo(timestamp) {
  const difference =
    Date.now() - new Date(timestamp).getTime();

  const minutes = Math.floor(
    difference / 60000
  );

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
}

export function formatDate(date) {
  if (!date) {
    return "";
  }

  return new Date(date).toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}