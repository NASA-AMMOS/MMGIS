import { marked } from 'marked'

marked.setOptions({
    gfm: true,
    breaks: true,
})

export default marked
