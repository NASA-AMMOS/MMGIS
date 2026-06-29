/**
 * Dropy
 * https://codepen.io/Tombek/pen/OPvpLe
 * Heavily edited
 */
import $ from 'jquery'
import './dropy.css'

export default {
    openClass: 'open',
    selectClass: 'selected',
    // items []
    // placeholder
    // selectedIndex int null for none
    construct: function (items, placeholder, selectedIndex, options) {
        options = options || {}
        // prettier-ignore
        return [
            `<dl class="dropy${options.openUp === true ? ' openUp' : ''}${options.openHorizontal === true ? ' openHorizontal' : ''}${options.dark === true ? ' dark' : ''}">`,
                `<dt class="dropy__title">`,
                    `<span>${options.forcePlaceholder ? placeholder : items[selectedIndex] != null ? items[selectedIndex] : placeholder}</span>`,
                    `${options.hideChevron === true ? '' : `<i class='mdi mdi-chevron-down mdi-18px'></i>`}`,    
                `</dt>`,
                '<dd class="dropy__content">',
                    `<ul${options.openHorizontal === true && options.fixedItemWidth != null ? ` style="width: ${items.length * options.fixedItemWidth}px; transform: translateX(${(-items.length * options.fixedItemWidth / 2) + (options.fixedItemWidth / 2)}px) ;"`: ''}>`,
                        placeholder ? `<li><a class="dropy__header" style="pointer-events: none;">${placeholder}</a></li>` : '',
                        items.map((item, i) => `<li${options.fixedItemWidth != null ? ` style="width: ${options.fixedItemWidth}px;"`: ''}><a${i === selectedIndex ? ' class="selected"' : ""} idx=${i} title="${typeof item === 'string' && item.includes('<') ? '' : item}">${item}</a></li>`).join('\n'),
                    '</ul>',
                '</dd>',
                '<input type="hidden" name="first">',
            '</dl>'].join('\n')
    },
    // onChange(index, value, element)
    init: function (dropyElm, onChange, onOpen, onClose, options) {
        options = options || {}
        var self = this

        const initialDropyElm = dropyElm
        dropyElm = dropyElm.find('.dropy')
        if (options.globalConstruct != null) {
            dropyElm.find('ul').css({ display: 'none' })
            dropyElm = $('body').append(
                `<div id="${initialDropyElm.attr('id')}_global"></div>`
            )
        }

        // Opening a dropy
        initialDropyElm.find('.dropy__title').click(function () {
            $('.dropy').removeClass(self.openClass)
            $(this).parents('.dropy').addClass(self.openClass)
            if (options.globalConstruct != null) {
                const elm = $(`#${initialDropyElm.attr('id')}_global`)
                elm.empty()
                elm.append(options.globalConstruct)
                elm.find('.dropy').addClass(self.openClass)
                elm.find('.dropy__title').remove()
                elm.find('.dropy__header')
                    .css({ pointerEvents: 'all' })
                    .click(function () {
                        $('.dropy').removeClass(self.openClass)
                        const elm = $(`#${initialDropyElm.attr('id')}_global`)
                        elm.empty()
                    })
                elm.find('ul').css({ width: 'fit-content' })
                const bcr = initialDropyElm.get(0).getBoundingClientRect()
                elm.css({
                    position: 'fixed',
                    left: bcr.left + 5,
                    right: bcr.right,
                    top: bcr.top,
                    width: bcr.width,
                })
                const bcr2 = elm.find('ul').get(0).getBoundingClientRect()
                if (bcr2.left + bcr2.width > window.innerWidth) {
                    elm.css({ left: window.innerWidth - bcr2.width - 5 })
                }

                elm.find('.dropy__content ul li a').click(function () {
                    var $that = $(this)
                    var $dropy = $that.parents('.dropy')
                    var $input = $dropy.find('input')
                    var $title = $(this)
                        .parents('.dropy')
                        .find('.dropy__title span')

                    if (options.dontChange != true) {
                        // Remove selected class
                        $dropy.find('.dropy__content a').each(function () {
                            $(this).removeClass(self.selectClass)
                        })

                        // Update selected value
                        $title.html($that.html())
                        $input.val($that.attr('data-value')).trigger('change')

                        // If back to default, remove selected class else addclass on right element
                        if ($that.hasClass('dropy__header')) {
                            $title.removeClass(self.selectClass)
                            $title.html($title.attr('data-title'))
                        } else {
                            $title.addClass(self.selectClass)
                            $that.addClass(self.selectClass)
                        }
                    }

                    // Close dropdown
                    $dropy.removeClass(self.openClass)
                    $('.dropy').removeClass(self.openClass)
                    const elm = $(`#${initialDropyElm.attr('id')}_global`)
                    elm.empty()

                    if (typeof onClose === 'function') {
                        onClose()
                    }

                    if (typeof onChange === 'function') {
                        onChange(
                            parseInt($that.attr('idx')),
                            $that.text(),
                            $that
                        )
                    }
                })
            }
            if (typeof onOpen === 'function') {
                onOpen()
            }
        })

        if (options.globalConstruct == null) {
            // Click on a dropy list
            dropyElm.find('.dropy__content ul li a').click(function () {
                var $that = $(this)
                var $dropy = $that.parents('.dropy')
                var $input = $dropy.find('input')
                var $title = $(this)
                    .parents('.dropy')
                    .find('.dropy__title span')

                if (options.dontChange != true) {
                    // Remove selected class
                    $dropy.find('.dropy__content a').each(function () {
                        $(this).removeClass(self.selectClass)
                    })

                    // Update selected value
                    $title.html($that.html())
                    $input.val($that.attr('data-value')).trigger('change')

                    // If back to default, remove selected class else addclass on right element
                    if ($that.hasClass('dropy__header')) {
                        $title.removeClass(self.selectClass)
                        $title.html($title.attr('data-title'))
                    } else {
                        $title.addClass(self.selectClass)
                        $that.addClass(self.selectClass)
                    }
                }

                // Close dropdown
                $dropy.removeClass(self.openClass)

                if (typeof onClose === 'function') {
                    onClose()
                }

                if (typeof onChange === 'function') {
                    onChange(parseInt($that.attr('idx')), $that.text(), $that)
                }
            })
        }

        // Close all dropdown onclick on another element
        $(document).bind('click', function (e) {
            if (!$(e.target).parents().hasClass('dropy')) {
                $('.dropy').removeClass(self.openClass)
                if (typeof onClose === 'function') {
                    onClose()
                }
            }
        })
    },
}
