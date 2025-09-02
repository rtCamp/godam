
/**
 * External dependencies
 */
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';

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

	const showNotice = useCallback( ( setNoticeMethod, message, status = 'success' ) => {
		setNoticeMethod( { message, status, isVisible: true } );
		if ( window.scrollY > 0 ) {
			scrollToTop();
		}
	}, [] );

	const showCoreNotice = useCallback( ( message, status ) => {
		showNotice( setCoreMigrationNotice, message, status );
	}, [ showNotice ] );

	const showVimeoNotice = useCallback( ( message, status ) => {
		showNotice( setVimeoMigrationNotice, message, status );
	}, [ showNotice ] );

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
						isDismissible
						onRemove={ () => setCoreMigrationNotice( ( prev ) => ( { ...prev, isVisible: false } ) ) }
					>
						{ coreMigrationNotice.message }
					</Notice>
				) }
				{ vimeoMigrationNotice.isVisible && (
					<Notice
						status={ vimeoMigrationNotice.status }
						className="my-2"
						isDismissible
						onRemove={ () => setVimeoMigrationNotice( ( prev ) => ( { ...prev, isVisible: false } ) ) }
					>
						{ vimeoMigrationNotice.message }
					</Notice>
				) }
			</div>

			<CoreVideoMigration
				migrationStatus={ migrationStatus }
				setMigrationStatus={ setMigrationStatus }
				showNotice={ showCoreNotice }
			/>
			<VimeoVideoMigration
				migrationStatus={ vimeoMigrationStatus }
				setMigrationStatus={ setVimeoMigrationStatus }
				showNotice={ showVimeoNotice }
			/>
		</>
	);
};

export default MigrationTab;
