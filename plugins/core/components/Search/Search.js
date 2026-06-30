import React from 'react'
import { createRoot } from 'react-dom/client'
import SearchBar from './SearchBar'
import useUIStore from '@basics/UserInterface_/store/uiStore'

import './Search.css'

const Search = {
    _root: null,
    _container: null,

    init: function () {
        const target = document.getElementById('topBarRight')
        if (!target) return

        this._container = document.createElement('div')
        this._container.id = 'searchComponentMount'
        target.appendChild(this._container)

        this._root = createRoot(this._container)
        this._root.render(<SearchMount />)
    },
}

function SearchMount() {
    const isMobile = useUIStore((s) => s.isMobile)
    const lookConfig = useUIStore((s) => s.lookConfig)
    const searchBarVisible = useUIStore((s) => s.visibility.searchbar)

    if (isMobile || lookConfig.searchbar === false || !searchBarVisible) {
        return null
    }

    return <SearchBar />
}

export default Search
