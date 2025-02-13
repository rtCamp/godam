/**
 * External dependencies
 */
import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import EmojiPicker from 'emoji-picker-react';
import videojs from 'video.js';
import axios from 'axios';
/**
 * WordPress dependencies
 */
import { Icon } from '@wordpress/components';
import { plus, lineSolid } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

const ReactionControls = ( { children } ) => {
	return ReactDOM.createPortal(
		<>
			{ children }
		</>,
		document.querySelector( '.vjs-progress-control .vjs-progress-holder' ),
	);
};

const VideoReactions = ( { attachmentId } ) => {
	const [ open, setOpen ] = React.useState( false );
	const [ videoDuration, setVideoDuration ] = useState( 0 );
	const [ reactions, setReactions ] = useState( );

	const defaultReactions = [ '👍', '😮', '❤️', '😂', '🤩', '🙁', '👎' ];

	const playerRef = useRef();

	useEffect( () => {
		const playerId = 'godam_video_' + attachmentId + '_html5_api';
		const player = videojs( playerId );
		playerRef.current = player;

		player.addClass( 'godam-attachment' );

		player.on( 'loadedmetadata', () => {
			setVideoDuration( player.duration() );
		} );

		const url = '/wp-json/easydam/v1/video-reactions/' + attachmentId;

		axios.get( url )
			.then( ( response ) => {
				console.log( response.data );
				setReactions( response.data );
			} )
			.catch( ( error ) => {
				console.log( error );
			} );
	}, [] );

	const handleReactionClick = ( reaction ) => {
		console.log( reaction );

		const url = '/wp-json/easydam/v1/video-reactions';

		const reactionTime = playerRef.current.currentTime();

		axios.post( url,
			{
				attachment_id: attachmentId,
				reaction,
				reaction_time: reactionTime,
			},
			{
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpUser.nonce,
				},
			},
		)
			.then( ( response ) => {
				setReactions( [ ...reactions, {
					comment_ID: response.data.reaction_id,
					comment_content: reaction,
					reaction_time: reactionTime,
				} ] );
			} )
			.catch( ( error ) => {
				console.log( error );
			} );
	};

	const toggleEmojiPicker = () => {
		setOpen( ! open );
	};

	useEffect( () => {
		document.addEventListener( 'keydown', ( event ) => {
			if ( event.key === 'Escape' ) {
				setOpen( false );
			}
		} );
	}, [] );

	return (
		<>
			<div className="godam-reaction-picker">
				<div className="reaction-bar">
					{
						defaultReactions.map( ( reaction, index ) => {
							return (
								<button key={ index }
									className="reaction-item"
									onClick={ () => handleReactionClick( reaction ) }
								>{ reaction }</button>
							);
						} )
					}
					<button className="emoji-picker-btn"
						onClick={ toggleEmojiPicker }
					><Icon icon={ open ? lineSolid : plus } /></button>
				</div>
				{
					open &&
					<div className="emoji-picker">
						<EmojiPicker
							reactions={ false }
							onEmojiClick={ ( reaction ) => {
								setOpen( false );
								handleReactionClick( reaction.emoji );
							} }
						/>
					</div>
				}
			</div>
			{
				reactions && reactions.length > 0 &&
				<ReactionControls>
					<div className="godam-reactions">
						<div className="reactions-wrapper">
							{
								reactions.map( ( reaction, index ) => {
									return (
										<div key={ index }
											className="video-reaction-item"
											style={ {
												fontSize: '1rem',
												position: 'absolute',
												top: '-1.75rem',
												left: `${ reaction.reaction_time / videoDuration * 100 }%`,
											} }
										>
											<div className="reaction-content">
												{ reaction.comment_content }
												<div className="reaction-tooltip">
													{ reaction.username ?? __( 'Anonymous', 'godam' ) }
												</div>
											</div>
										</div>
									);
								} )
							}
						</div>
					</div>
				</ReactionControls>
			}
		</>
	);
};

const rootElement = document.getElementById( 'root-player-reactions' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );
	const reactionsData = rootElement?.dataset?.reactions ?? [];

	root.render( <VideoReactions reactionsData={ reactionsData } attachmentId={ rootElement?.dataset?.attachment_id } /> );
}
