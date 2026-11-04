/** The renderer is always local; the query selects the remote NiBUS connection. */
export const getGmibWindowUrl = (
  localHttpPort: number,
  nibusPort: number,
  address: string,
  devServerUrl?: string,
): string => {
  const query = new URLSearchParams({ port: String(nibusPort), host: address });
  return `${devServerUrl ?? `http://localhost:${localHttpPort}/index.html`}?${query}`;
};
