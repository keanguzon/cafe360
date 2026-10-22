export function refreshPage() {
  window.location.reload();
}

export function retryPage(href: string) {
  window.location.assign(href);
}
