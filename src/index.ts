import { 
	code, 
	execute, 
	javascript, 
	GlobalState, 
	ComponentFromConfig, 
	Component,
	Tag,
	WRAP,
	MATCH,
	BoxProp,
	TagProps,
	ProgrammingLanguage,
	javascriptBundle
} from "polygraphic";
import { DocumentOutput } from "./types";

export const render = <Global extends GlobalState, Local>(
	root : ComponentFromConfig<Global, Local>
) => (
		state : Global & Local
	) : DocumentOutput => {    
		const component = root({
			parent : {
				width : MATCH,
				height : MATCH,
				name : "root"
			},
			global : state,
			local : state
		});
		const output : DocumentOutput = {
			js : [
				"var adapters = {};",
				"var events = {};",
				"var listeners = [];",
				`var global = ${JSON.stringify(state)};`,
			],
			css : [],
			html : [],
			cache : new Set()
		};
		handle({
			component,
			global: state,
			local : state,
			output
		});
		output.js.push("bind(document.body, Local(global, 0));");
		return output;
	};

function failed(_ : never) {
	throw new Error("this should never happen");
}

const getTagName = (name : Tag) : {
    name : string
    selfClosing : boolean
} => {
	switch(name) {        
	case "option":
	case "select":
	case "button":
		return {
			name,
			selfClosing : false
		};
	case "text":
		return {
			name : "span",
			selfClosing : false
		};
	case "stack":
	case "scrollable":
	case "row":
	case "root":
	case "column":
		return {
			name : "div",
			selfClosing : false
		};
	case "input":
		return {
			name : "input",
			selfClosing : true
		};
	}
};

const numberToMeasurement = (input : number | null | undefined) : string => {
	if(input === null || input === undefined) {
		return "";
	}
	if(0 < input && input < 1) {
		return `${input * 100}%`;
	} else if(input === WRAP) {
		return "auto";
	} else if(input === MATCH) {
		return "100%";
	} else {
		return `${input}px`;
	}
};

const handleBox = (prefix : string, input : BoxProp<Array<unknown> | number>, props : TagProps) => {
	keys(input).forEach(key => {
		const value = input[key];
		if(value instanceof Array) {
			props.style[`${prefix}${key}`] = value.map(it => typeof it === "number" ? numberToMeasurement(it) : it).join(" ");
		} else {
			props.style[`${prefix}${key}`] = numberToMeasurement(value);
		}
	});
};

const handleProp = <Global extends GlobalState, Local, Key extends keyof Component<Global, Local>>({
	component,
	name,
	value,
	props,
} : {
    component : Component<Global, Local>
    name : Key
    value : Component<Global, Local>[Key]
    props : TagProps
}) : TagProps => {
	switch(name) {
	case "width":
	case "height":
		if(typeof value === "number") {
			props.style[name] = numberToMeasurement(value);
		}
		return props;
	case "name":
		if(value === "stack") {
			props.style.position = "relative";
		} else if(value === "row" || value === "column") {
			props.style.display = "flex";
			props.style["flex-direction"] = value.toString();
		}
		if(value === "scrollable") {
			props.style.overflow = "auto";
		}
		return props;
	case "background":
		props.style.background = value?.toString() ?? "";
		return props;
	case "grow":
		props.style["flex-grow"] = value ? "1" : "";
		return props;
	case "id":
		props["data-id"] = value?.toString() ?? "";
		return props;
	case "position":
		props.style.position = "absolute";
		handleBox("", value as BoxProp<number | Array<unknown>>, props);
		return props;
	case "padding":
	case "margin":
	case "border":
		handleBox(`${name}-`, value as BoxProp<number | Array<unknown>>, props);
		return props;
	case "visible":
		if(!value) {
			props.style.display = "none";
		}
		return props;
	case "value":
		props.value = value?.toString() ?? "";
		return props;
	case "placeholder":
		props.placeholder = value?.toString() ?? "";
		return props;
	case "enabled":
		props.disabled = value === false ? "disabled" : "";
		return props;
	case "onDragStart":
		props.draggable = "true";
		return props;
	case "color":
		props.style.color = value;
		return props;
	case "size":
		props.style.fontSize = `${value}px`;
		return props;
	case "src":
		props.src = value;
		return props;
	case "crossAxisAlignment":
		if(component.name === "row") {
			// TODO
		} else if(component.name==="column") {
			// TODO
		}
		return props;
	case "mainAxisAlignment":
		if(component.name === "row") {
			// TODO
		} else if(component.name==="column") {
			// TODO
		}
		return props;
	case "onDragEnd":
	case "onDrop":
	case "onInit":
	case "onClick":
	case "onEnter":
	case "onInput":
	case "onBack":
	case "observe":
	case "onSelect":
	case "children":
	case "text":
	case "adapters":
	case "data":
	case "focus":
	case "animation":
		// TODO
		return props;
	}
	failed(name);
	return props;
};

const handleChildren = <Global extends GlobalState, Local, Key extends keyof Component<Global, Local>>({
	component,
	name,
	value,
	output,
	global,
	local
} : {
    component : Component<Global, Local>
    name : Key
    value : Component<Global, Local>[Key]
    output : DocumentOutput
    global : Global
    local : Local
}) => {
	switch(name) {
	case "text":
		output.html.push(value?.toString() ?? "");
		return;
	case "children":
		(value as Component<Global, Local>[]).forEach(component => handle({
			component,
			local,
			global,
			output
		}));
		return;
	case "adapters": {
		const adapter = value as Component<Global, Local>["adapters"];
		const data = component.data;
		if(adapter) {
			for(const index in adapter) {
				const key = `${component.id}_${index}`;
				if(!output.cache.has(key)) {
					output.cache.add(key);
					const child = adapter[index]({
						global : global,
						local : null,
						parent : {
							height : 0,
							width : 0,
							name : "root",                                
						}
					}).children?.[0];
					if(child) {
						const adapterOutput = handle({
							component : child,
							global,
							local : null,
							output : {
								cache : output.cache,
								css : output.css,
								html : [],
								js : output.js
							}
						});
						output.js.push(`adapters.${key} = $('${adapterOutput.html.join("")}')`);
					}
				}
			}
			if(data) {
				data.forEach(local => {
					const parent : Component<Global, unknown> = {
						width : 0,
						height : 0,
						name : "root"
					};
					adapter[local.adapter || "local"]({
						global,
						local,
						parent
					});
					return handle({
						component : (parent.children || [])[0],
						global,
						local,
						output
					});
				});
			}
		}
		return;
	}
	case "onBack": // TODO : THIS ONE IS SPECIAL IN THAT IT IS THE ONLY ONE WITH A RETURN TYPE
	case "onInit":
	case "onDragStart":
	case "onDragEnd":
	case "onDrop":
	case "observe":
	case "onInput":
	case "onEnter":
	case "onSelect":
	case "onClick": {
		const id = `${name}:${component.id}`;
		if(!output.cache.has(id)) {
			output.cache.add(id);
			output.js.push(`setEvent("${component.id}", "${name}", function(local, index, event) {`);
			(value as Array<(config : any) => ProgrammingLanguage>).forEach((callback) => {
				const generated = code(callback, new Set([]));
				output.js.push(javascript(generated, "\t"));
			});
			output.js.push("});");
		}
		return;
	}
	case "visible":
	case "padding":
	case "margin":
	case "border":
	case "id":
	case "width":
	case "height":
	case "name":
	case "background":
	case "grow":
	case "data":
	case "position":
	case "value":
	case "placeholder":
	case "enabled":
	case "focus":
	case "src":
	case "size":
	case "color":
	case "animation":
	case "mainAxisAlignment":
	case "crossAxisAlignment":
		return;
	}
	failed(name);
};

const keys = <T>(input : T) => Object.keys(input) as (keyof T)[];

const handle = <Global extends GlobalState, Local>({
	component,
	local,
	global,
	output
} : {
    component : Component<Global, Local>
    local : Local
    global : Global
    output : DocumentOutput
}) : DocumentOutput => {
	const {
		name,
		selfClosing
	} = getTagName(component.name);

	if(component.observe && local) {
		component.observe.forEach(callback => {
			const generated = code(callback, new Set([]));
			execute(generated, {
				global,
				local,
				event : component
			});
		});
	}

	const props = keys(component).reduce((props, name) => {
		return handleProp<Global, Local, typeof name>({
			component,
			name,
			props,
			value: component[name]
		});
	}, {
		style : {}
	} as TagProps);

	const render = Object.keys(props).map(key => {
		const value = props[key];
		if(key !== "children" && value) {
			if(typeof value === "object") {
				return `style="${keys(value).map((key) => {
					return `${key.toString()}:${value[key]}`;
				}).join(";")}"`;
			} else {
				return `${key}="${value}"`;
			}
		}
	}).filter(_ => _).join(" ");

	if(selfClosing) {
		output.html.push(`<${name} ${render}/>`);
	} else {
		output.html.push(`<${name} ${render}>`);
	}
	keys(component).forEach((name) => {
		handleChildren({
			component,
			output,
			local,
			global,
			name,
			value : component[name]
		});
	});
	if(!selfClosing) {
		output.html.push(`</${name}>`);
	}

	return output;
};

const document = ({
	scripts,
	html,
	js
} : {    
    scripts : string[]
    html : string
    js : string
}) => `<!doctype html>
    <html>
        <style>
html, body {
    display : flex;
    width : 100%;
    min-height : 100%;
}
html, body, button {
    background : transparent;
    margin : 0;
    padding : 0;
    border : 0;
    font-size : 16px;
}
button {
    background : green;
    border-radius : 4px;
    padding : 4px;
}
* { 
    box-sizing: border-box;
}
        </style>
        ${scripts.map(src => `<script src="${src}"></script>`).join("")}
    <head>
    </head>
    <body>
        ${html}
        <script>
${javascriptBundle()}
var socket = (function () {
    var socket = io();
    return {
        on : function(name, callback) {
            socket.on(name, function(data) {
                callback({ data })
                update();
            })
        }
    };
})();
function Local(value, index) {
    return {
        value : value,
        index : index
    };
}
function $(html) {
    var div = document.createElement("div");
    div.innerHTML = html;
    var child = div.children[0];
    return function() {
        return child.cloneNode(true);
    };
}
function setEvent(id, name, callback) {
    events[id] = events[id] || {};
    events[id][name] = callback;
}

function numberToMeasurement(input) {
    if(input === null || input === undefined) {
        return "";
    }
    if(0 < input && input < 1) {
        return (input * 100) + "%";
    } else if(input === ${WRAP}) {
        return "auto";
    } else if(input === ${MATCH}) {
        return "100%";
    } else {
        return input + "px";
    }
}
function Component(component) {
    var cache = {};
    return new Proxy(component, {
        get : function(target, key) {
            if(key === "isMounted") {
                return document.body.contains(component);
            }
        },
        set : function(target, key, value) {
            if(!(key in cache) || cache[key] !== value) {
                cache[key] = value;
                switch(key) {
                    case "width":
                    case "height":
                        target.style[key] = numberToMeasurement(value);
                        return;
                    case "focus":
                        target.focus();
                        target.setSelectionRange(0, target.value.length);
                        return;
                    case "enabled":
                        target.disabled = !value;
                        return;
                    case "placeholder":
                        target.placeholder = value;
                        return;
                    case "value":
                        target.value = value;
                        return;
                    case "text":
                        target.innerText = value;
                        return;
                    case "data":
                        var prev = cache.prevData || [];
                        var curr = value.map(function(it) {
                            return "id" in it ? it.id : it.key;
                        });
                        // REMOVE
                        var removed = [];
                        for(var i = prev.length - 1; i >= 0; i--) {
                            if(!curr.includes(prev[i])) {
                                prev.splice(i, 1);
                                removed.push(target.removeChild(target.children[i]));
                            }
                        }
                        // ADD
                        for(var i = 0; i < curr.length; i++) {
                            if(!prev.includes(curr[i])) {
                                var item = value[i];
                                // TODO : ATTEMPT TO REUSE REMOVED COMPONENTS
                                var child = adapters[target.dataset.id + "_" + item.adapter]();
                                bind(child, Local(item, i))
                                if(i < target.children.length) {
                                    target.insertBefore(child, target.children[i]);
                                } else {
                                    target.appendChild(child);
                                }
                            }
                        }
                        // MOVE / UPDATE
                        for(var i = 0; i < value.length; i++) {
                            target.children[i].__local__.value = value[i];
                            target.children[i].__local__.index = i;
                        }
                        cache.prevData = curr;
                        target.value = cache.value;
                        return;
                    case "background":
                        target.style.background = value;
                        return;
                    case "visible":
                        target.style.display = value ? (target.style.flexDirection ? "flex" : "block") : "none";
                        return;
                }
            }
        }
    });
}
var update = (function() {
    var timeout;
    return function() {
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            listeners.forEach(function (listener) {
                listener.callback(listener.local.value, listener.local.index, listener.component)
            });        
            listeners = listeners.filter(function(listener) {
                return listener.component.isMounted;
            });
        });
    }
})();
function bind(root, local) {
    root.__local__ = local;
    Array.from(root.querySelectorAll("[data-id]")).concat(root.dataset.id ? [root] : []).forEach(function(component) {
        var toBind = events[component.dataset.id];
        Object.keys(toBind).forEach(function(event) {
            var callback = toBind[event];
            if(event === "onDrop") {
                function prevent(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.cancelBubble = true;
                    return false;
                };
                component.ondragenter = prevent
                component.ondragleave = prevent
                component.ondragover = prevent
                component.ondrop = function() {
                    callback(local.value, local.index);
                    update();
                };
            } else if(event === "onDragStart") {
                component.ondragstart = function() {
                    callback(local.value, local.index);
                    update();
                };
            } else if(event === "onDragEnd") {
                component.ondragend = function() {
                    callback(local.value, local.index);
                    update();
                };
            } else if(event === "onSelect") {
                component.onchange = function() {
                    callback(local.value, local.index, this.value);
                    update();
                };
            } else if(event === "onInput") {
                component.oninput = function() {
                    callback(local.value, local.index, this.value);
                    update();
                };
            } else if(event === "onClick") {
                component.onclick = function() {
                    callback(local.value, local.index/*,event*/);
                    update();
                };
            } else if(event === "onEnter") {
                component.onkeypress = function(e) {
                    if(e.which === 13) {
                        callback(local.value, local.index);
                        update();
                    }
                };
            } else if(event === "observe") {
                var wrapped = Component(component);
                callback(local.value, local.index, wrapped)
                listeners.push({
                    component : wrapped,
                    callback : callback,
                    local : local,
                });
            } else if(event === "onInit") {
                callback(local.value, local.index);
                update();
            }
        });
    });
}
        </script>
        <script>
${js}
        </script>
    </body>
</html>`;