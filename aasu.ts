import * as lf from "localforage";

enum NodeType {
    Inner,
    Leaf,
}

enum ReturnType {
    NotFound = undefined,
    Invalid = null,
}

interface Node {
    type: NodeType;
    data: any;
}

class InnerNode implements Node {
    type = NodeType.Inner;
    data: string[];
}

class LeafNode implements Node {
    type = NodeType.Leaf;
    data: any;
}

function decomp(path: string): string[] {
    return path.split(".");
}

function comp(frags: string[]): string {
    return frags.join(".");
}

/* public */

export async function set(path: string, data: Node["data"]): Promise<void> {
    const frags = decomp(path);
    for (let i = 1, l = frags.length; i <= l; ++i) {
        const partialPath = frags.slice(0, i).join(".");

        const innerNode: Node = await lf.getItem(partialPath);
        if (
            innerNode === null ||
            i === l && innerNode.type === NodeType.Inner ||
            i < l && innerNode.type === NodeType.Leaf
        ) {
            // create the new inner/leaf node
            let node: Node;
            if (i === l) {
                node = new LeafNode();
                node.data = data;
            } else {
                node = new InnerNode();
                node.data = [];
            }
            await lf.setItem(partialPath, node);

            // add it to the list of its parent if not already there
            if (i > 1) {
                const parentKey = comp(frags.slice(0, i - 1));
                const parentNode: InnerNode = await lf.getItem(parentKey);
                const frag = frags[i - 1];
                if (!parentNode.data.includes(frag)) {
                    parentNode.data.push(frag);
                    await lf.setItem(parentKey, parentNode);
                }
            }
        }
    }
}

export async function has(path: string): Promise<boolean> {
    return (await lf.getItem(path) !== null);
}

export async function list(path: string): Promise<string[] | ReturnType> {
    if (path == null) {
        const keys = await lf.keys();
        return keys.filter(key => !key.includes("."));
    } else {
        const node: Node = await lf.getItem(path);
        if (node === null) return ReturnType.NotFound;
        else if (node.type === NodeType.Leaf) return ReturnType.Invalid;
        else if (node.type === NodeType.Inner) return node.data;
    }
}

export async function get(path: string): Promise<any> {
    const node: Node = await lf.getItem(path);

    if (node === null) return ReturnType.NotFound;
    else if (node.type === NodeType.Inner) return ReturnType.Invalid;
    else if (node.type === NodeType.Leaf) return node.data;
}

export async function remove(path: string): Promise<void> {
    const node: Node = await lf.getItem(path);
    if (node === null) return; // not found

    const frags = decomp(path);

    // remove from parent's list
    if (frags.length > 1) {
        const parentPath = comp(frags.slice(0, -1));
        const parentNode: Node = await lf.getItem(parentPath);
        const ind = parentNode.data.indexOf(frags[frags.length - 1]);
        if (ind !== -1) {
            parentNode.data.splice(ind, 1);
        }
        await lf.setItem(parentPath, parentNode);
    }

    // remove children
    if (node.type === NodeType.Inner) {
        const promises = [];
        for (const childKey of node.data) {
            promises.push(new Promise(resolve => {
                remove(comp([path, childKey])).then(resolve);
            }));
        }
        await Promise.all(promises);
    }

    // remove node
    await lf.removeItem(path);
}

export async function clear(): Promise<void> {
    await lf.clear();
}
