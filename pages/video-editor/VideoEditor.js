/**
 * External dependencies
 */
import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import axios from 'axios';

/**
 * Internal dependencies
 */
import VideoJSPlayer from './VideoJSPlayer';
import SidebarLayers from './components/SidebarLayers';
import Appearance from './components/appearance/Appearance';
import { initializeStore, saveVideoMeta } from './redux/slice/videoSlice';

/**
 * WordPress dependencies
 */
import { Button, TabPanel, Snackbar } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import Video from './Video';

const VideoEditor = ( { attachmentID } ) => {
	const videoData = window.videoData;

	const [ video, setVideo ] = useState( null );
	const [ currentTime, setCurrentTime ] = useState( 0 );
	const [ showSaveMessage, setShowSaveMessage ] = useState( false );

	const dispatch = useDispatch();
	const videoConfig = useSelector( ( state ) => state.videoReducer.videoConfig );
	const layers = useSelector( ( state ) => state.videoReducer.layers );
	const isChanged = useSelector( ( state ) => state.videoReducer.isChanged );

	const saveAttachmentMeta = () => {
		// Update the attchment meta
		const data = {
			easydam_meta: { videoConfig, layers },
		};
		// update media meta via REST API
		axios.post( `/wp-json/wp/v2/media/${ attachmentID }`, data, {
			headers: {
				'X-WP-Nonce': videoData.nonce,
			},
		} )
			.then( ( response ) => {
				if ( response.status === 200 ) {
					// Dispatch the action to update the store
					dispatch( saveVideoMeta() );
					setShowSaveMessage( true );
					setTimeout( () => {
						setShowSaveMessage( false );
					}, 2500 );
				}
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	};

	return (
		<>
			<div className="video-editor-container">
				<aside className="py-3">
					<div id="sidebar-content" className="border-b">
						<TabPanel
							onSelect={ () => {} }
							className="sidebar-tabs"
							tabs={ [
								{
									name: 'layers',
									title: 'Layers',
									className: 'flex-1 justify-center items-center',
									component: <SidebarLayers currentTime={ currentTime } />,
								},
								{
									name: 'video-settings',
									title: 'Player Settings',
									className: 'flex-1 justify-center items-center',
									component: <Appearance />,
								},
							] }
						>
							{ ( tab ) => tab.component }
						</TabPanel>
					</div>
				</aside>

				<main className="flex justify-center items-center p-4 relative overflow-y-auto">
					<Button
						className="absolute right-4 top-5"
						variant="primary"
						disabled={ ! isChanged }
						onClick={ saveAttachmentMeta }
					>
						{ __( 'Save', 'transcoder' ) }
					</Button>

					{
						// Display a success message when video changes are saved
						showSaveMessage && (
							<Snackbar className="absolute bottom-4 right-4 opacity-70">
								{ __( 'Video changes saved successfully', 'transcoder' ) }
							</Snackbar>
						)
					}

					<Video currentTime={ currentTime } setCurrentTime={ setCurrentTime } attachmentID={ attachmentID } videoData={ videoData } />
				</main>
			</div>
		</>
	);
};

export default VideoEditor;
