export type DocumentOutput = {
    html : string[]
    js : string[]
    css : string[]
    scripts : string[]
    cache : Set<string>
}