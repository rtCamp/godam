/**
 * Unit tests for the Delete and Edit controls on a video comment.
 *
 * The server says whether a comment belongs to the viewer (`is_own`); the
 * player no longer compares emails. These tests render one comment and check
 * which controls show, and what the Delete button sends.
 */

/**
 * External dependencies
 */
import { act } from 'react';

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

// The emoji picker ships as ESM and is not rendered here.
jest.mock( 'emoji-picker-react', () => () => null );

jest.mock( '@wordpress/api-fetch', () => {
	const mock = jest.fn();
	mock.use = jest.fn();
	mock.createNonceMiddleware = jest.fn( () => jest.fn() );
	return { __esModule: true, default: mock };
} );

// engagement.js reads window.godamData once, when it loads.
window.godamData = {
	currentLoggedInUserData: { email: 'viewer@example.com', name: 'Viewer', type: 'user' },
	loginUrl: '/wp-login.php',
	registrationUrl: '/wp-login.php?action=register',
	defaultAvatar: 'https://avatar.test/default',
	nonce: 'nonce',
};

/**
 * Internal dependencies
 */
const { Comment } = require( './engagement' );

global.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * A comment as the activities route returns it.
 *
 * @param {Object} overrides Fields to change.
 * @return {Object} Comment.
 */
const makeComment = ( overrides = {} ) => ( {
	id: 'c-1',
	parent_id: null,
	text: 'Nice video',
	author_name: 'Alice',
	author_image: 'https://avatar.test/alice',
	is_own: false,
	created_at_date: 'Today',
	created_at_time: '10:00 AM',
	children: [],
	...overrides,
} );

describe( 'Comment controls', () => {
	let container;
	let root;
	let storeObj;
	let setCommentsData;

	/**
	 * Render a comment as a signed-in viewer.
	 *
	 * @param {Object} comment Comment to render.
	 * @param {Object} props   Extra props for the component.
	 */
	const renderComment = ( comment, props = {} ) => {
		act( () => {
			root.render(
				<Comment
					comment={ comment }
					setCommentsData={ setCommentsData }
					storeObj={ storeObj }
					videoAttachmentId={ 42 }
					siteUrl="https://www.example.com"
					isUserLoggedIn={ true }
					videoContainerRef={ { current: null } }
					{ ...props }
				/>,
			);
		} );
	};

	const deleteButton = () => container.querySelector( '.comment-button-delete' );
	const editButton = () => container.querySelector( '.comment-button-edit' );
	const replyButton = () => container.querySelector( '.comment-button-reply' );

	beforeEach( () => {
		apiFetch.mockReset();
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		setCommentsData = jest.fn();
		storeObj = {
			select: {
				getUserData: () => ( { email: 'viewer@example.com', name: 'Viewer', type: 'user' } ),
			},
			dispatch: {
				errorHappened: jest.fn(),
				userCommented: jest.fn(),
			},
		};
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'shows Delete and Edit on a comment the server marks as the viewer\'s own', () => {
		renderComment( makeComment( { is_own: true } ) );

		expect( deleteButton() ).not.toBeNull();
		expect( editButton() ).not.toBeNull();
		expect( replyButton() ).not.toBeNull();
	} );

	it( 'shows only Reply on someone else\'s comment', () => {
		renderComment( makeComment( { is_own: false } ) );

		expect( replyButton() ).not.toBeNull();
		expect( deleteButton() ).toBeNull();
		expect( editButton() ).toBeNull();
	} );

	it( 'does not treat a matching email in the comment as ownership', () => {
		renderComment( makeComment( { author_email: 'viewer@example.com' } ) );

		expect( deleteButton() ).toBeNull();
		expect( editButton() ).toBeNull();
	} );

	it( 'shows no Delete or Edit when a comment has no is_own flag', () => {
		const comment = makeComment();
		delete comment.is_own;
		renderComment( comment );

		expect( deleteButton() ).toBeNull();
	} );

	it( 'shows no controls on an own comment that was already deleted', () => {
		renderComment( makeComment( { is_own: true, text: '--soft-deleted-content--' } ) );

		expect( deleteButton() ).toBeNull();
		expect( editButton() ).toBeNull();
	} );

	it( 'shows no controls to a viewer who is not signed in', () => {
		renderComment( makeComment( { is_own: false } ), { isUserLoggedIn: false } );

		expect( replyButton() ).toBeNull();
		expect( deleteButton() ).toBeNull();
	} );

	it( 'sends the comment id and delete type, and no email, when Delete is clicked', async () => {
		apiFetch.mockResolvedValue( { status: 'success', data: { text: '--hard-deleted-content--' } } );
		renderComment( makeComment( { is_own: true } ) );

		await act( async () => {
			deleteButton().click();
		} );

		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
		const request = apiFetch.mock.calls[ 0 ][ 0 ];
		expect( request.path ).toBe( '/godam/v1/engagement/user-delete-comment' );
		expect( request.method ).toBe( 'POST' );
		expect( request.data ).toEqual( { video_id: 42, comment_id: 'c-1', delete_type: 'hard-delete' } );
		expect( JSON.stringify( request.data ) ).not.toContain( '@' );
		expect( setCommentsData ).toHaveBeenCalled();
	} );

	it( 'soft-deletes a comment that has replies', async () => {
		apiFetch.mockResolvedValue( { status: 'success', data: { text: '--soft-deleted-content--' } } );
		renderComment( makeComment( { is_own: true, children: [ makeComment( { id: 'c-2' } ) ] } ) );

		await act( async () => {
			deleteButton().click();
		} );

		expect( apiFetch.mock.calls[ 0 ][ 0 ].data.delete_type ).toBe( 'soft-delete' );
	} );

	it( 'reports the refusal and leaves the comment alone when the server says no', async () => {
		apiFetch.mockRejectedValue( { message: 'You can only change your own comments.' } );
		renderComment( makeComment( { is_own: true } ) );

		await act( async () => {
			deleteButton().click();
		} );

		expect( storeObj.dispatch.errorHappened ).toHaveBeenCalledWith( 'You can only change your own comments.' );
		expect( setCommentsData ).not.toHaveBeenCalled();
		expect( deleteButton().disabled ).toBe( false );
	} );
} );
