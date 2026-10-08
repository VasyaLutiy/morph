```ts
export function wordCount(text: string): number {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  return words.length;
}
```
