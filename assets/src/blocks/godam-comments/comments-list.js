/**
 * External dependencies
 */
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';

/**
 * Internal dependencies
 */
import CommentForm from './comment-form';
import { useEffect } from 'react';

const CommentsList = ( { postId, comments, updateComments, editCommentId, setEditCommentId, replayCommentId, setReplayCommentId, isChild } ) => {
	const [ displayReplies, setDisplayReplies ] = useState( [] );

	useEffect( () => {
		const replies = comments.map( ( comment ) => ( { id: comment.id, display: false } ) );
		setDisplayReplies( replies );
	}, [] );

	// Function to calculate time ago.
	function timeAgo( gmtDateString ) {
		const date = new Date( gmtDateString );

		const now = new Date();
		const diffInSeconds = Math.floor( ( now - date ) / 1000 );

		if ( diffInSeconds < 60 ) {
			return 'just now';
		}
		const minutes = Math.floor( diffInSeconds / 60 );
		if ( minutes < 60 ) {
			return `${ minutes }min`;
		}
		const hours = Math.floor( minutes / 60 );
		if ( hours < 24 ) {
			return `${ hours }h`;
		}
		const days = Math.floor( hours / 24 );
		if ( days < 30 ) {
			return `${ days }d`;
		}
		const months = Math.floor( days / 30 );
		if ( months < 12 ) {
			return `${ months }m`;
		}
		const years = Math.floor( days / 365 );
		return `${ years }y`;
	}

	const deleteComment = ( commentId ) => {
		// Delete a comment.
		// Update a comment.
		axios.delete( `/wp-json/wp/v2/comments/${ commentId }`, {
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.wpUser.nonce,
			},
		} )
			.then( ( response ) => {
				updateComments( 'delete', { id: commentId } );
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	};

	console.log( 'display replies', displayReplies );

	return (
		<>
			<ul className={ `godam-comments-list ${ isChild ? 'child' : '' }` }>
				{
					comments.map( ( comment ) => {
						return (
							<li
								key={ comment.id }
							>
								{
									editCommentId === comment.id ? (
										<CommentForm
											postId={ postId }
											commentId={ comment.id }
											onClose={ () => setEditCommentId( null ) }
											value={ comment.content.raw }
											onEdit={ ( data ) => {
												updateComments( 'edit', { ...data, children: comment.children } );
												setEditCommentId( null );
											} }
										/>
									) : (
										<>
											<div className="godam-comments-list--item">
												{ /* Author avatar */ }
												<div className="godam-comments-list--item--avatar">
													<img src={ comment.author_avatar_urls[ 24 ] } alt={ comment.author_name } />
												</div>

												{ /* Comment body */ }
												<div className="godam-comments-list--item--main">
													<div className="godam-comments-list--item--main--header">
														<div className="godam-comments-list--item--main--header--author">{ comment.author_name }</div>
														<div className="godam-comments-list--item--main--header--time">01:25</div>
														<div className="godam-comments-list--item--main--header--date">{ timeAgo( comment.date_gmt ) }</div>
													</div>

													<div className="godam-comments-list--item--main--content" dangerouslySetInnerHTML={ { __html: comment.content.rendered } } />

													{
														replayCommentId !== comment.id &&
														<div className="godam-comments-list--item--main--footer">
															<button
																className="replay godam-comment-btn"
																onClick={ () => {
																	setEditCommentId( null );
																	setReplayCommentId( comment.id );
																} }
															>
																<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
																	<path d="M14.25 13.25C13.75 7.25 8.75 5.75 6.25 6.25V2.75L1.75 8L6.25 13.25V9.75C8.75 9.25 12.75 10.25 14.25 13.25Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
																</svg>

																{ __( 'Reply', 'godam' ) }
															</button>

															{
																Number( window?.wpUser?.ID ) === comment.author && (
																	<button
																		className="edit godam-comment-btn"
																		onClick={ () => {
																			setReplayCommentId( null );
																			setEditCommentId( comment.id );
																		} }
																	>
																		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
																			<path d="M10.4987 1.9646C10.7488 1.71464 11.0878 1.57422 11.4414 1.57422C11.7949 1.57422 12.134 1.71464 12.3841 1.9646L14.0341 3.6146C14.1579 3.73842 14.2562 3.88543 14.3232 4.04723C14.3903 4.20903 14.4248 4.38246 14.4248 4.5576C14.4248 4.73274 14.3903 4.90617 14.3232 5.06797C14.2562 5.22977 14.1579 5.37678 14.0341 5.5006L6.10538 13.4293L1.85205 14.1466L2.57005 9.89327L10.4987 1.9646ZM10.3461 4.0026L11.9961 5.6526L13.0914 4.55727L11.4414 2.90793L10.3461 4.0026ZM11.0527 6.59593L9.40338 4.94593L3.81405 10.5353L3.47872 12.5199L5.46338 12.1853L11.0527 6.59593Z" fill="currentColor" />
																		</svg>

																		{ __( 'Edit', 'godam' ) }
																	</button>
																)
															}
															{
																Number( window?.wpUser?.ID ) === comment.author && (
																	<button
																		className="delete godam-comment-btn"
																		onClick={ () => {
																			deleteComment( comment.id );
																		} }
																	>
																		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
																			<path d="M6.66683 3.99992H9.3335C9.3335 3.6463 9.19302 3.30716 8.94297 3.05711C8.69292 2.80706 8.35379 2.66659 8.00016 2.66659C7.64654 2.66659 7.3074 2.80706 7.05735 3.05711C6.80731 3.30716 6.66683 3.6463 6.66683 3.99992ZM5.3335 3.99992C5.3335 3.29267 5.61445 2.6144 6.11454 2.1143C6.61464 1.6142 7.29292 1.33325 8.00016 1.33325C8.70741 1.33325 9.38568 1.6142 9.88578 2.1143C10.3859 2.6144 10.6668 3.29267 10.6668 3.99992H14.0002C14.177 3.99992 14.3465 4.07016 14.4716 4.19518C14.5966 4.32021 14.6668 4.48977 14.6668 4.66659C14.6668 4.8434 14.5966 5.01297 14.4716 5.13799C14.3465 5.26301 14.177 5.33325 14.0002 5.33325H13.4122L12.8215 12.2266C12.7647 12.8922 12.4601 13.5123 11.9681 13.9641C11.476 14.416 10.8322 14.6667 10.1642 14.6666H5.83616C5.1681 14.6667 4.52435 14.416 4.03226 13.9641C3.54018 13.5123 3.23561 12.8922 3.17883 12.2266L2.58816 5.33325H2.00016C1.82335 5.33325 1.65378 5.26301 1.52876 5.13799C1.40373 5.01297 1.3335 4.8434 1.3335 4.66659C1.3335 4.48977 1.40373 4.32021 1.52876 4.19518C1.65378 4.07016 1.82335 3.99992 2.00016 3.99992H5.3335ZM10.0002 7.99992C10.0002 7.82311 9.92992 7.65354 9.8049 7.52851C9.67988 7.40349 9.51031 7.33325 9.3335 7.33325C9.15669 7.33325 8.98712 7.40349 8.86209 7.52851C8.73707 7.65354 8.66683 7.82311 8.66683 7.99992V10.6666C8.66683 10.8434 8.73707 11.013 8.86209 11.138C8.98712 11.263 9.15669 11.3333 9.3335 11.3333C9.51031 11.3333 9.67988 11.263 9.8049 11.138C9.92992 11.013 10.0002 10.8434 10.0002 10.6666V7.99992ZM6.66683 7.33325C6.84364 7.33325 7.01321 7.40349 7.13823 7.52851C7.26326 7.65354 7.3335 7.82311 7.3335 7.99992V10.6666C7.3335 10.8434 7.26326 11.013 7.13823 11.138C7.01321 11.263 6.84364 11.3333 6.66683 11.3333C6.49002 11.3333 6.32045 11.263 6.19543 11.138C6.0704 11.013 6.00016 10.8434 6.00016 10.6666V7.99992C6.00016 7.82311 6.0704 7.65354 6.19543 7.52851C6.32045 7.40349 6.49002 7.33325 6.66683 7.33325ZM4.50683 12.1133C4.53523 12.4462 4.68761 12.7563 4.93379 12.9823C5.17997 13.2082 5.50202 13.3335 5.83616 13.3333H10.1642C10.4981 13.3331 10.8198 13.2077 11.0657 12.9818C11.3116 12.7559 11.4638 12.446 11.4922 12.1133L12.0735 5.33325H3.92683L4.50683 12.1133Z" fill="currentColor" />
																		</svg>
																		{ __( 'Delete', 'godam' ) }
																	</button>
																)
															}
														</div>
													}
													{
														replayCommentId === comment.id && (
															<CommentForm
																className="pl-6 mt-4"
																postId={ postId }
																parentCommentId={ comment.id }
																onClose={ () => setReplayCommentId( null ) }
																onReply={ ( data ) => {
																	updateComments( 'addReply', { ...data, Children: [] } );
																	setReplayCommentId( null );
																} }
															/>
														)
													}

													{
														comment.children.length > 0 && (
															<>

																<button
																	className="view-replies-btn"
																	onClick={ ( e ) => {
																		const target = e.target;
																		const repliesEl = target.nextElementSibling;
																		if ( repliesEl ) {
																			repliesEl.style.display = 'flex';
																			target.style.display = 'none';
																		}
																	} }
																>{ comment.children.length } { __( 'Replies', 'godam' ) }</button>

																<CommentsList
																	postId={ postId }
																	comments={ comment.children }
																	updateComments={ updateComments }
																	editCommentId={ editCommentId }
																	setEditCommentId={ setEditCommentId }
																	replayCommentId={ replayCommentId }
																	setReplayCommentId={ setReplayCommentId }
																	isChild={ true }
																/>

															</>
														)
													}
												</div>
											</div>
										</>
									)
								}
							</li>
						);
					} )
				}
			</ul>
		</>
	);
};

export default CommentsList;
