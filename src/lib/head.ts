export const pageHead = (title: string, description: string) => () => ({
  meta: [
    { title: `${title} · Guardia Veterinaria 24 h` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} · Guardia Veterinaria 24 h` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
