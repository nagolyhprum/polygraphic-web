import { Component, GlobalState } from "polygraphic";

export type Manifest = Component<GlobalState, GlobalState>["manifest"]

export type DocumentOutput = {
    name : string
    html : string[]
    js : string[]
    css : {
        letter : string
        query : string
        cache : {
            [className : string] : {
                [styleName : string] : {
                    [styleValue : string] : string | null
                } | null
            } | null
        }
        queries : {
            [queryName : string] : {
                [className : string] : {
                    [styleName : string] : string | null
                } | null
            } | null
        }
    }
    scripts : string[]
    cache : Set<string>
    dependencies : Set<string>
    manifest?: Manifest
}

export type TagProps = Record<string, string> & {
    style : never
    className : Set<string>
}