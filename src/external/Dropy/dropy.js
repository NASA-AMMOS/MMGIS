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
    construct: function (items, placeholder, selectedIndex) {
        console.log(items)
        // prettier-ignore
        return [
            '<dl class="dropy">',
                `<dt class="dropy__title"><span>${items[selectedIndex] || placeholder}</span></dt>`,
                '<dd class="dropy__content">',
                    '<ul>',
                        placeholder ? `<li><a class="dropy__header" style="pointer-events: none;">${placeholder}</a></li>` : '',
                        items.map((item, i) => `<li><a${i === selectedIndex ? ' class="selected"' : ""} idx=${i} title="${item.includes('<') ? '' : item}">${item}</a></li>`).join('\n'),
                    '</ul>',
                '</dd>',
                '<input type="hidden" name="first">',
            '</dl>'].join('\n')
    },
    // onChange(index, value, element)
    init: function (dropyElm, onChange, onOpen, onClose) {
        var self = this

        dropyElm = dropyElm.find('.dropy')

        // Opening a dropy
        dropyElm.find('.dropy__title').click(function () {
            $('.dropy').removeClass(self.openClass)
            $(this).parents('.dropy').addClass(self.openClass)
            if (typeof onOpen === 'function') {
                onOpen()
            }
        })

        // Click on a dropy list
        dropyElm.find('.dropy__content ul li a').click(function () {
            var $that = $(this)
            var $dropy = $that.parents('.dropy')
            var $input = $dropy.find('input')
            var $title = $(this).parents('.dropy').find('.dropy__title span')

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

            // Close dropdown
            $dropy.removeClass(self.openClass)

            if (typeof onClose === 'function') {
                onClose()
            }

            if (typeof onChange === 'function') {
                onChange(parseInt($that.attr('idx')), $that.text(), $that)
            }
        })

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
