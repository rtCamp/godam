/**
 * External dependencies
 */
import { useSelector } from 'react-redux';
import { useMemo } from 'react';

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

const LockedTab = ( { handleContextMenu } ) => {
	const folders = useSelector( ( state ) => state.FolderReducer?.folders || [] );

	// Get all the locked folders where `meta.locked` is true
	// and sort them based on the currentSortOrder
	const locked = useMemo( () => {
		return folders
			?.filter( ( folder ) => folder?.meta?.locked ) || [];
	}, [ folders ] );

	const lockedCount = locked?.length || 0;

	if ( lockedCount === 0 ) {
		return (
			<div className="godam-folder-tab godam-folder-tab--empty">
				<Panel className="godam-folder-tab-panel">
					<PanelBody
						title={ <><span className="folder-tab__count">{ lockedCount }</span> { __( 'Locked', 'godam' ) } </> }
						initialOpen={ true }
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
		<div className="godam-folder-tab">
			<Panel className="godam-folder-tab-panel">
				<PanelBody
					title={ <><span className="folder-tab__count">{ lockedCount }</span> { __( 'Locked', 'godam' ) } </> }
					initialOpen={ true }
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
