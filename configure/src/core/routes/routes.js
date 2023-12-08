import React, { useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { BrowserRouter as Router, Switch, Route, Link } from 'react-router-dom'

import Topbar from '../../components/Topbar'
import Toolbar from '../../components/Toolbar/Toolbar'
import SnackBar from '../../components/SnackBar/SnackBar'

import Search from '../../pages/Search/Search'
import Record from '../../pages/Record/Record'
import FileExplorer from '../../pages/FileExplorer/FileExplorer'
import Cart from '../../pages/Cart/Cart'

import InformationModal from '../../pages/Search/Modals/InformationModal/InformationModal'
import FeedbackModal from '../../pages/Search/Modals/FeedbackModal/FeedbackModal'

import { HASH_PATHS } from '../constants'
import { loadMappings } from '../redux/actions/actions.js'

import './routes.css'

export const Routes = () => {
    const dispatch = useDispatch()
    // On first load, grab all the atlas index mappings
    useEffect(() => {
        dispatch(loadMappings('atlas'))
    }, [])

    return (
        <div className="Routes">
            <Router>
                <Toolbar />
                <div className="routeMain">
                    <Topbar />
                    <Switch location={location}>
                        <Route
                            exact
                            path={HASH_PATHS.search}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <Search />
                                    </div>
                                )
                            }}
                        />
                        <Route
                            exact
                            path={HASH_PATHS.record}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <Record />
                                    </div>
                                )
                            }}
                        />
                        <Route
                            exact
                            path={HASH_PATHS.cart}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <Cart />
                                    </div>
                                )
                            }}
                        />
                        <Route
                            path={HASH_PATHS.fileExplorer}
                            component={() => {
                                return (
                                    <div className="routeContent">
                                        <FileExplorer />
                                    </div>
                                )
                            }}
                        />
                    </Switch>
                </div>
            </Router>
            <InformationModal />
            <FeedbackModal />
            <SnackBar />
        </div>
    )
}
