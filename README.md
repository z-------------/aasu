# Aasu

Aasu is flat local storage for the browser.

## Concept

Aasu stores nested properties flatly at the root. For example,

```javascript
await aasu.set("foo", "Aasu is (not) flat");
await aasu.set("bar.baz.qux", "Hello, Aasu!");
```

is stored as:

```
foo:
    type: NodeType.Leaf
    data: "Aasu is (not) flat"
bar:
    type: NodeType.Inner
    data: ["baz"]
bar.baz:
    type: NodeType.Inner
    data: ["qux"]
bar.baz.qux:
    type: NodeType.Leaf
    data: "Hello, Aasu!"
```

This way, there is no need to read and write an item's entire containing subtree just to get or set the item's properties. For structures with large items or many siblings, this may lead to performance improvements (untested) and just feels better.

## [Documentation →](https://github.com/z-------------/aasu/wiki/Documentation)
