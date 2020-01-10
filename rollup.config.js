import commonjs from "@rollup/plugin-commonjs"
import resolve from "@rollup/plugin-node-resolve";

export default {
    input: "aasu.js",
    output: {
        file: "aasu.bundle.js",
        format: "iife",
        name: "aasu",
        exports: "named",
    },
    plugins: [
        commonjs({
            namedExports: {
                "localforage": ["getItem", "setItem", "removeItem", "clear", "keys"],
            },
        }),
        resolve(),
    ]
};
