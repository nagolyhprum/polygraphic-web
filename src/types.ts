import { Component, GlobalState } from "polygraphic";

export type Manifest = Component<GlobalState, GlobalState>["manifest"]

export type DocumentOutput = {
    name : string
    html : string[]
    js : string[]
    css : string[]
    scripts : string[]
    cache : Set<string>
    dependencies : Set<string>
    manifest?: Manifest
}