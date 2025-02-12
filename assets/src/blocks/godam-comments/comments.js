/**
 * External dependencies
 */
import ReactDOM from 'react-dom';
import axios from 'axios';
/**
 * WordPress dependencies
 */
import { Button, TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { edit, trash } from '@wordpress/icons';
/**
 * Internal dependencies
 */
import CommentForm from './comment-form';
import CommentsList from './comments-list';
import { convertToTree } from './utils';

const Comments = ( { attachmentId } ) => {
	const [ comments, setComments ] = useState( [] );
	const [ editCommentId, setEditCommentId ] = useState( null );
	const [ replayCommentId, setReplayCommentId ] = useState( null );

	useEffect( () => {
		const url = `/wp-json/wp/v2/comments?post=${ attachmentId }&context=edit`;
		axios.get( url, {
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.wpUser.nonce,
			},
		} )
			.then( ( response ) => {
				setComments( response.data );
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	}, [] );

	const updateComments = ( action, payload ) => {
		switch ( action ) {
			case 'add':
				setComments( [ payload, ...comments ] );
				break;
			case 'addReply':
				setComments( [ payload, ...comments ] );
				break;
			case 'edit':
				setComments( comments.map( ( comment ) => comment.id === payload.id ? payload : comment ) );
				break;
			case 'delete':
				setComments( comments.filter( ( comment ) => comment.id !== payload.id ) );
				break;
			default:
				break;
		}
	};

	return (
		<>
			<CommentForm
				postId={ attachmentId }
				onAdd={ ( comment ) => updateComments( 'add', { ...comment, children: [] } ) }
			/>

			{ /* Comments */ }
			<CommentsList
				postId={ attachmentId }
				comments={ convertToTree( comments ) }
				updateComments={ updateComments }
				editCommentId={ editCommentId }
				setEditCommentId={ setEditCommentId }
				replayCommentId={ replayCommentId }
				setReplayCommentId={ setReplayCommentId }
				isChild={ false }
			/>
		</>
	);
};

const rootElement = document.getElementById( 'root-godam-comments' );

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );

	root.render( <Comments attachmentId={ rootElement?.dataset?.post_id } /> );
}
