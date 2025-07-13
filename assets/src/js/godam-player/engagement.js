const { createReduxStore, register, select, dispatch, subscribe } = wp.data;
const { apiFetch } = wp;
const { addQueryArgs } = wp.url;

const DEFAULT_STATE = {
	views: {},
	likes: {},
};

const ACTIONS = {
	LOAD_VIDEO_ENGAGEMENT_DATA: 'LOAD_VIDEO_ENGAGEMENT_DATA',
	USER_HIT_LIKE: 'USER_HIT_LIKE',
	USER_VIEWED: 'USER_VIEWED',
};

const processEngagements = ( collections ) => {
	const engagementLikesData = {};
	const engagementViewsData = {};
	collections.forEach( ( item ) => {
		engagementLikesData[ item.videoAttachmentId ] = item.data.likes_count;
		engagementViewsData[ item.videoAttachmentId ] = item.data.views_count;
	} );

	return {
		views: engagementViewsData,
		likes: engagementLikesData,
	};
};

const engagementStore = {
	init() {
		this.initStore();
	},

	reducer( state = DEFAULT_STATE, action ) {
		switch ( action.type ) {
			case ACTIONS.LOAD_VIDEO_ENGAGEMENT_DATA:
				const collections = processEngagements( action.collections );
				return {
					...state,
					...collections,
				};
			case ACTIONS.USER_HIT_LIKE:
				if ( action.likeCollections.includes( action.videoAttachmentId ) ) {
					state.likes[ action.videoAttachmentId ] = state.likes[ action.videoAttachmentId ] + 1;
				} else {
					state.likes[ action.videoAttachmentId ] = state.likes[ action.videoAttachmentId ] - 1;
				}
				return {
					...state,
				};
			case ACTIONS.USER_CANCELED_LIKED:
				return {
					...state,
				};
			case ACTIONS.USER_VIEWED:
				return {
					...state,
				};
			default:
				return state;
		}
	},

	actions: {
		userHitiLke: ( videoAttachmentId, storeObj ) => {
			const likeCollections = storeObj.checkIfUserLiked( videoAttachmentId );
			return {
				type: ACTIONS.USER_HIT_LIKE,
				videoAttachmentId,
				likeCollections,
			};
		},
		userShared: () => {
			return {
				type: ACTIONS.USER_VIEWED,
			};
		},

		loadDefaultData: async ( storeObj ) => {
			const collections = await storeObj.getVideoEngagementData();
			return {
				type: ACTIONS.LOAD_VIDEO_ENGAGEMENT_DATA,
				collections,
			};
		},
	},

	selectors: {
		getState: ( state ) => state,
	},

	resolvers: {},

	store() {
		return createReduxStore( 'godam-video-engagement', {
			reducer: this.reducer,
			actions: this.actions,
			selectors: this.selectors,
			resolvers: this.resolvers,
		} );
	},

	watch() {
		const state = this.select.getState();
		this.distributeData( state );
	},

	distributeData( state ) {
		const likes = state.likes;
		const views = state.views;
		const videoIds = document.querySelectorAll( '.rtgodam-video-engagement' );
		if ( 0 === videoIds.length ) {
			return null;
		}
		videoIds.forEach( ( item ) => {
			const videoAttachmentId = item.getAttribute( 'data-engagement-video-id' );
			const likeLink = item.querySelector( '.rtgodam-video-engagement--like-count' );
			const viewLink = item.querySelector( '.rtgodam-video-engagement--view-count' );
			likeLink.innerHTML = likes[ videoAttachmentId ] || 0;
			viewLink.innerHTML = views[ videoAttachmentId ] || 0;
		} );
	},

	async fetchVideoData( videoId, videoAttachmentId, siteUrl ) {
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
		};
		return await apiFetch( { path: addQueryArgs( '/godam/v1/engagement/activities', queryParams ) } ).then( ( response ) => {
			return {
				videoAttachmentId,
				...response,
			};
		} );
	},

	async getVideoEngagementData() {
		const self = this;
		const collections = [];
		const videoIds = document.querySelectorAll( '.rtgodam-video-engagement' );

		if ( 0 === videoIds.length ) {
			return null;
		}

		const promises = [];

		videoIds.forEach( ( item ) => {
			const videoId = item.getAttribute( 'data-engagement-id' );
			const videoAttachmentId = item.getAttribute( 'data-engagement-video-id' );
			const siteUrl = item.getAttribute( 'data-engagement-site-url' );

			const likeLink = item.querySelector( '.rtgodam-video-engagement--like-link' );
			const commentLink = item.querySelector( '.rtgodam-video-engagement--like-comment' );

			if ( likeLink ) {
				likeLink.addEventListener( 'click', ( event ) => {
					event.preventDefault();
					self.dispatch.userHitiLke( videoAttachmentId, self );
				} );
			}

			promises.push( self.fetchVideoData( videoId, videoAttachmentId, siteUrl ) );
		} );

		const results = await Promise.all( promises );
		collections.push( ...results );
		return collections;
	},

	checkIfUserLiked( videoAttachmentId ) {
		let likeCollections = window.localStorage.getItem( 'godam-video-like-collections' ) || '[]';
		likeCollections = JSON.parse( likeCollections );
		if ( likeCollections.includes( videoAttachmentId ) ) {
			likeCollections = likeCollections.filter( ( item ) => item !== videoAttachmentId );
		} else {
			likeCollections.push( videoAttachmentId );
		}
		window.localStorage.setItem( 'godam-video-like-collections', JSON.stringify( likeCollections ) );
		return likeCollections;
	},

	initStore() {
		register( this.store() );
		this.unsubscribe = subscribe(
			this.watch.bind( this ),
			'godam-video-engagement',
		);
		this.dispatch = dispatch( 'godam-video-engagement' );
		this.select = select( 'godam-video-engagement' );

		this.dispatch.loadDefaultData( this );

		// For testing purposes
		window.gdm_dispatch = this.dispatch;
		window.gdm_select = this.select;
	},
};

export function engagement() {
	engagementStore.init();
}
