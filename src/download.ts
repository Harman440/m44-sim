// download.ts
/** Save data as a pretty-printed JSON file (Chrome on the tablet puts it in Descargas) */
export const downloadJson = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
