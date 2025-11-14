/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useRef } from 'react';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { Panel, PanelBody } from '@wordpress/components';
import { lock } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import './css/foldertabs.scss';
import TabItem from './TabItem.jsx';
import { useGetFoldersQuery } from '../../redux/api/folders.js';
import { initializeLockedFolders } from '../../redux/slice/folders.js';

const LockedTab = ( { handleContextMenu } ) => {
	const { data: lockedData, isLoading: isLockedLoading } = useGetFoldersQuery( { locked: true } );
	const dispatch = useDispatch();
	const initializedRef = useRef( false );

	useEffect( () => {
		if ( ! initializedRef.current && lockedData && ! isLockedLoading ) {
			// Dispatch an action to set the locked folders in the Redux store
			dispatch( initializeLockedFolders( lockedData?.data || [] ) );
			initializedRef.current = true;
		}
	}, [ lockedData, dispatch, isLockedLoading ] );

	const locked = useSelector( ( state ) => state.FolderReducer?.lockedFolders || [] );

	useEffect( () => {
		const event = new CustomEvent( 'godam:lockedFolderLoaded', {
			detail: { ids: locked.map( ( folder ) => folder.id ) },
		} );

		window.dispatchEvent( event );
	}, [ locked ] );

	const lockedCount = locked?.length;

	if ( lockedCount === 0 ) {
		return (
			<div className="godam-folder-tab godam-folder-tab--empty no-drop">
				<Panel className="godam-folder-tab-panel">
					<PanelBody
						title={ <><span className="folder-tab__count">{ lockedCount }</span> { __( 'Locked', 'godam' ) } </> }
						initialOpen={ false }
						icon={ lock }
					>
						<div className="godam-folder-tab__empty-state">
							<div className="godam-folder-tab__empty-icon">
								{ lock }
							</div>
							<h4>{ __( 'No locked folders yet', 'godam' ) }</h4>
						</div>
					</PanelBody>
				</Panel>
			</div>
		);
	}

	return (
		<div className="godam-folder-tab no-drop">
			<Panel className="godam-folder-tab-panel">
				<PanelBody
					title={ <><span className="folder-tab__count">{ lockedCount }</span> { __( 'Locked', 'godam' ) } </> }
					initialOpen={ false }
					icon={ lock }
				>
					<div className="godam-folder-tab__list">
						{ locked.map( ( lockedFolder, index ) => (
							<TabItem
								item={ lockedFolder }
								key={ lockedFolder?.id || index }
								index={ index }
								totalCount={ lockedCount }
								onContextMenu={ ( e, id ) => handleContextMenu( e, id, lockedFolder ) }
							/>
						) ) }
					</div>
				</PanelBody>
			</Panel>
		</div>
	);
};

export default LockedTab;
