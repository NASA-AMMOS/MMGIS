import $ from "jquery";

const addOption = (title, root) =>
    $(`<div><div>${title}</div></div>`).appendTo(root);

export function createInputWithUnit(title, root, unit, value, attr = "") {
    const innerContainer = $(`<div class="flexbetween"></div>`)
        .appendTo(addOption(title, root));
    const el = $( `<input type="number" ${attr} value="${value}">`)
        .appendTo(innerContainer);
    $(`<div class="unit">${unit}</div>`).appendTo(innerContainer);
    return el;
}

export function createDropdown(title, root, options = []) {
    let el = $(`<select class="dropdown"></select>`)
        .appendTo(addOption(title, root))
    const numOptions = options.length;
    let selStr = " selected";
    for(let i = 0; i < numOptions; i++) {
        const optionEl =
            $(`<option value=${i}${selStr}></option>`).appendTo(el);
        optionEl.html(options[i]);
        selStr = "";
    }
    return el;
}