# Sample Document

A quick tour of what **MD Explorer** renders. See [the other page](docs/guide.md#install) too.

## Text

Some *italic*, **bold**, ~~strikethrough~~, `inline code`, and a [link](https://example.com).
Press <kbd>Ctrl</kbd> + <kbd>B</kbd> to toggle the explorer.

> A blockquote with a little wisdom.

- [x] Task done
- [ ] Task pending

| Language | Typing  | Year |
|----------|---------|-----:|
| Python   | Dynamic | 1991 |
| Rust     | Static  | 2015 |

## Code

```python
def fib(n: int) -> int:
    """Return the nth Fibonacci number."""
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
```

```typescript
interface User { id: number; name: string }
const greet = (u: User): string => `Hello, ${u.name}!`;
```

```bash
npm install && npm start
```

<details><summary>Click to expand</summary>

Hidden content with <script>alert('xss')</script> stripped.

</details>
