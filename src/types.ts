import { Component, GlobalState } from "polygraphic";

export type Manifest = Component<GlobalState, GlobalState>["manifest"]

export type DocumentOutput = {
    font : string
    analytics : string
    recaptcha : string
    name : string
    html : string[]
    js : string[]
    head : {
        title : string
        metas : Record<string, string>
        links : Record<string, string>
    }
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
    stylesheets : string[]
    cache : Set<string>
    dependencies : Set<string>
    manifest?: Manifest
}

export type TagProps = Record<string, string> & {
    style : never
    className : Set<string>
}