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
import { convertToTree } from './utils';
import CommentsList from './comments-list';

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
				setComments( convertToTree( response.data ) );
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	}, [] );

	return (
		<>
			<CommentForm
				postId={ attachmentId }
				onAdd={ ( comment ) => setComments( [ { ...comment, children: [] }, ...comments ] ) }
			/>

			{ /* Comments */ }
			<CommentsList
				postId={ attachmentId }
				comments={ comments }
				setComments={ setComments }
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
