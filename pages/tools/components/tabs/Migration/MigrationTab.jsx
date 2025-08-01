
/**
 * External dependencies
 */
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';

/**
 * Internal dependencies
 */
import CoreVideoMigration from './CoreVideoMigration.jsx';
import VimeoVideoMigration from './VimeoVideoMigration.jsx';
import { Notice } from '@wordpress/components';
import { scrollToTop } from '../../../../godam/utils';

const MigrationTab = () => {
	const [ migrationStatus, setMigrationStatus ] = useState( null );
	const [ vimeoMigrationStatus, setVimeoMigrationStatus ] = useState( null );
	const [ coreMigrationNotice, setCoreMigrationNotice ] = useState( { message: '', status: 'success', isVisible: false } );
	const [ vimeoMigrationNotice, setVimeoMigrationNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	const fetchMigrationStatus = async ( type ) => {
		const url = window.godamRestRoute?.url + 'godam/v1/video-migration/status?type=' + type;

		try {
			const response = await axios.get( url, {
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.godamRestRoute?.nonce,
				},
			} );
			if ( type === 'core' ) {
				setMigrationStatus( response.data );
			} else if ( type === 'vimeo' ) {
				setVimeoMigrationStatus( response.data );
			}
		} catch ( error ) {
			// Handle error, e.g., show a notification instead of using console
			// console.error( 'Error fetching migration status:', error );
		}
	};

	const showNotice = ( setNoticeMethod, message, status = 'success' ) => {
		setNoticeMethod( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	};

	useEffect( () => {
		// Check if the migration is already in progress or completed
		fetchMigrationStatus( 'core' );
		fetchMigrationStatus( 'vimeo' );
	}, [] );

	return (
		<>
			{ /* Migration status messages */ }
			<div className="status-notices-container">
				{ coreMigrationNotice.isVisible && (
					<Notice
						status={ coreMigrationNotice.status }
						className="my-2"
						onRemove={ () => setCoreMigrationNotice( { ...coreMigrationNotice, isVisible: false } ) }
					>
						{ coreMigrationNotice.message }
					</Notice>
				) }
				{ vimeoMigrationNotice.isVisible && (
					<Notice
						status={ vimeoMigrationNotice.status }
						className="my-2"
						onRemove={ () => setVimeoMigrationNotice( { ...vimeoMigrationNotice, isVisible: false } ) }
					>
						{ vimeoMigrationNotice.message }
					</Notice>
				) }
			</div>

			<CoreVideoMigration
				migrationStatus={ migrationStatus }
				setMigrationStatus={ setMigrationStatus }
				showNotice={ ( message, status ) => showNotice( setCoreMigrationNotice, message, status ) }
			/>
			<VimeoVideoMigration
				migrationStatus={ vimeoMigrationStatus }
				setMigrationStatus={ setVimeoMigrationStatus }
				showNotice={ ( message, status ) => showNotice( setVimeoMigrationNotice, message, status ) }
			/>
		</>
	);
};

export default MigrationTab;
