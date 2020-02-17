import * as lf from "localforage";

enum NodeType {
    Inner,
    Leaf,
}

export enum ReturnType {
    NotFound = undefined,
    Invalid = null,
}

interface Node {
    type: NodeType;
    data: any;
}

export interface Dictionary {
    [key: string]: any;
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

function getPathMapping(dict: Dictionary, parentPath = ""): Dictionary {
    const mapping = {};
    for (const [key, val] of Object.entries(dict)) {
        const path = parentPath.length ? comp([parentPath, key]) : key;
        if (typeof val === "object") {
            const subMapping = getPathMapping(val, path);
            Object.assign(mapping, subMapping);
        } else {
            mapping[path] = val;
        }
    }
    return mapping;
}

function arrayBox(items: any[]): [any][] {
    return items.map(item => [item]);
}

async function doAll(f: (...args: any[]) => Promise<any>, args: any[][]): Promise<any[]> {
    if (args.length === 0) return [];

    const promises = [];
    for (const a of args) {
        promises.push(f(...a));
    }
    return await Promise.all(promises);
}

/* public */

export async function set(path: string, data: any): Promise<void> {
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

export async function setAll(dict: Dictionary): Promise<void> {
    for (const [path, value] of Object.entries(dict)) {
        await set(path, value);
    }
}

export async function put(path: string, dict: Dictionary): Promise<void> {
    const mapping = getPathMapping(dict, path);
    await setAll(mapping);
}

export async function has(path: string): Promise<boolean> {
    return (await lf.getItem(path) !== null);
}

export function hasAll(paths: string[]): Promise<boolean[]> {
    return doAll(has, arrayBox(paths));
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

export function listAll(paths: string[]): Promise<(string[] | ReturnType)[]> {
    return doAll(list, arrayBox(paths));
}

export async function get(path: string): Promise<any> {
    const node: Node = await lf.getItem(path);

    if (node === null) return ReturnType.NotFound;
    else if (node.type === NodeType.Leaf) return node.data;
    else if (node.type === NodeType.Inner) {
        const result = {};
        const promises = [];
        for (const key of node.data) {
            promises.push(new Promise(resolve => {
                get(`${path}.${key}`).then(value => {
                    result[key] = value;
                    resolve();
                });
            }));
        }
        await Promise.all(promises);
        return result;
    }
}

export function getAll(paths: string[]): Promise<any[]> {
    return doAll(get, arrayBox(paths));
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
            promises.push(remove(comp([path, childKey])));
        }
        await Promise.all(promises);
    }

    // remove node
    await lf.removeItem(path);
}

export function removeAll(paths: string[]): Promise<void[]> {
    return doAll(remove, arrayBox(paths));
}

export async function clear(): Promise<void> {
    await lf.clear();
}
