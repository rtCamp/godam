/**
 * WordPress dependencies
 */
import { Button, Icon } from '@wordpress/components';
import { edit, media } from '@wordpress/icons';
/**
 * External dependencies
 */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Provider } from 'react-redux';
import ReactDOM from 'react-dom/client';
/**
 * Internal dependencies
 */
import store from './redux/store';
import Analytics from './Analytics';
import './index.scss';

const Frontpage = () => {
	const [ attachmentID, setAttachmentID ] = useState( null );
	useEffect( () => {
		// Check if the attachment ID is present in the URL
		const urlParams = new URLSearchParams( window.location.search );
		const id = urlParams.get( 'id' );

		// Check if valid attachment ID is present
		if ( id && ! isNaN( id ) ) {
			setAttachmentID( id );
		}
	}, [] );

	const OpenVideoSelector = () => {
		const fileFrame = wp.media( {
			title: __( 'Select video', 'godam' ),
			button: {
				text: __( 'View analytics', 'godam' ),
			},
			library: {
				type: 'video',
			},
			multiple: false,
		} );

		fileFrame.on( 'select', function() {
			const attachment = fileFrame.state().get( 'selection' ).first().toJSON();

			// Create a new URLSearchParams object from the current URL
			const urlParams = new URLSearchParams( window.location.search );

			// Set or update the search parameter
			urlParams.set( 'id', attachment.id );

			// Update the browser's URL without reloading the page
			const newUrl = `${ window.location.pathname }?${ urlParams.toString() }`;
			window.history.replaceState( null, '', newUrl );

			setAttachmentID( attachment.id );
		} );

		fileFrame.open();
	};

	if ( ! attachmentID ) {
		return (
			<>
				<div className="flex justify-center items-center h-screen">
					<div className="flex flex-col items-center justify-center">
						<Icon
							style={ {
								fill: '#6b7280',
							} }
							icon={ media }
							size={ 140 }
						/>
						<h2 className="text-gray-500">
							{ __( 'No video is selected', 'godam' ) }
						</h2>

						<Button
							className="mt-4"
							variant="primary"
							onClick={ OpenVideoSelector }
							icon={ edit }
							iconPosition="right"
						>
							{ __( 'Select Video to Edit', 'godam' ) }
						</Button>
					</div>
				</div>
			</>
		);
	}

	return (
		<>
			<Provider store={ store }>
				<Analytics attachmentID={ attachmentID } />
			</Provider>
		</>
	);
};

const App = () => {
	return <Frontpage />;
};

export default App;

const container = document.getElementById( 'root-video-analytics' );
const root = ReactDOM.createRoot( container );
root.render( <App /> );
