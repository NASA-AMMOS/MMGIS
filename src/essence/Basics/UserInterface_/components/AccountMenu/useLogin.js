import { useEffect, useState } from 'react'

export default function useLogin() {
    const [Login, setLogin] = useState(null)
    const [, setUpdate] = useState(0)

    useEffect(() => {
        let active = true
        import('../Login/Login').then((m) => {
            if (active) setLogin(m.default)
        })
        const update = () => setUpdate((n) => n + 1)
        document.addEventListener('mmgis:loginchange', update)
        document.addEventListener('mmgis:accountprovider', update)
        return () => {
            active = false
            document.removeEventListener('mmgis:loginchange', update)
            document.removeEventListener('mmgis:accountprovider', update)
        }
    }, [])

    return Login
}
