import $ from 'jquery';

export function addOption(title, root) {
    return $(`<div><div>${title}</div></div>`).appendTo(root);
}
export function addSection(title, root) {
    $(`<div class="sectionhead">${title}</div>`).appendTo(root);
    return $(`<section></section>`).appendTo(root);
}

export function createInput(title, root, unit, value, attr = "") {
    const innerContainer = $(`<div class="flexbetween"></div>`)
        .appendTo(addOption(title, root));
    const el = $( `<input type="number" ${attr} value="${value}">`)
        .appendTo(innerContainer);
    if (unit) {
        $(`<div class="unit">${unit}</div>`).appendTo(innerContainer);
    } else {
        el.addClass('nounit');
    }
    return el;
}

export function createDropdown(title, root, options = []) {
    let el = $(`<select class="dropdown"></select>`)
        .appendTo(addOption(title, root))
    const numOptions = options.length;
    let selStr = ' selected';
    for(let i = 0; i < numOptions; i++) {
        const optionEl =
            $(`<option value=${i}${selStr}></option>`).appendTo(el);
        optionEl.html(options[i]);
        selStr = '';
    }
    return el;
}

export function createLoadBar(msg, root, error = false) {
    const container = $(`<div class="loading"></div>`).appendTo(root);
    $(`<span>${msg}</span>`).appendTo(container);
    return $(`<div${error ? ' class="error"' : ''}></div>`).appendTo(container);
}
