/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';

/**
 * Internal dependencies
 */
import store from './redux/store';
import VideoEditor from './VideoEditor';
import './style.scss';
import '../../assets/build/blocks/easydam-player/style-index.css';

/**
 * WordPress dependencies
 */
import { Button, Icon, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { edit, media } from '@wordpress/icons';

const Frontpage = () => {
	const [ attachmentID, setAttachmentID ] = useState( null );
	const [ notice, setNotice ] = useState( { message: '', status: 'success', isVisible: false } );

	useEffect( () => {
		// Check if the attachment ID is present in the URL
		const urlParams = new URLSearchParams( window.location.search );
		const id = urlParams.get( 'id' );

		// Check if valid attachment ID is present
		if ( id && ! isNaN( id ) ) {
			setAttachmentID( id );
		} else {
			OpenVideoSelector();
		}
	}, [] );

	const OpenVideoSelector = () => {
		const fileFrame = wp.media( {
			title: __( 'Select video to edit', 'transcoder' ),
			button: {
				text: __( 'Edit video', 'transcoder' ),
			},
			library: {
				type: 'video', // Restrict to images only
			},
			multiple: false, // Disable multiple selection
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			if ( attachment.type === 'video' ) {
				// Create a new URLSearchParams object from the current URL.
				const urlParams = new URLSearchParams( window.location.search );

				// Set or update the search parameter.
				urlParams.set( 'id', attachment.id );

				// Update the browser's URL without reloading the page.
				const newUrl = `${ window.location.pathname }?${ urlParams.toString() }`;
				window.history.replaceState( null, '', newUrl );

				setAttachmentID( attachment.id );
			} else {
				// Show a notice for invalid selection
				setNotice( { message: __( 'Please select a valid image file.', 'transcoder' ), status: 'error', isVisible: true } );
				window.scrollTo( { top: 0, behavior: 'smooth' } );
				setTimeout( () => {
					setNotice( { message: '', status: '', isVisible: false } );
				}, 5000 );
			}
		} );

		fileFrame.open();
	};

	if ( ! attachmentID ) {
		return (
			<>
				<div className="flex justify-center items-center h-screen relative">
					{ notice?.isVisible && (
						<div className="absolute top-4 right-4" style={ { zIndex: 9999 } }>
							<Notice
								status={ notice.status }
								onRemove={ () => setNotice( { ...notice, isVisible: false } ) }
							>
								{ notice.message }
							</Notice>
						</div>
					) }
					<div className="flex flex-col items-center justify-center">

						<Icon style={ {
							fill: '#6b7280',
						} } icon={ media } size={ 140 } />
						<h2 className="text-gray-500">{ __( 'No video is selected', 'transcoder' ) }</h2>

						<Button
							className="mt-4"
							variant="primary"
							onClick={ OpenVideoSelector }
							icon={ edit }
							iconPosition="right"
						>
							{ __( 'Select Video to Edit', 'transcoder' ) }
						</Button>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<Provider store={ store }>
				<VideoEditor attachmentID={ attachmentID } />
			</Provider>
		</>
	);
};

const App = () => {
	return (
		<Frontpage />
	);
};

export default App;

ReactDOM.render( <App />, document.getElementById( 'root-video-editor' ) );
