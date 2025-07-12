const { createReduxStore, register, select, dispatch, subscribe } = wp.data;
const { apiFetch } = wp;
const { addQueryArgs } = wp.url;

const DEFAULT_STATE = {
	views: {},
	likes: {},
};

const ACTIONS = {
	LOAD_VIDEO_ENGAGEMENT_DATA: 'LOAD_VIDEO_ENGAGEMENT_DATA',
	USER_LIKED: 'USER_LIKED',
	USER_CANCELED_LIKED: 'USER_CANCELED_LIKED',
	USER_VIEWED: 'USER_VIEWED',
};

const getVideoEngagementData = async ( store ) => {
	const collections = [];
	const videoIds = document.querySelectorAll( '.rtgodam-video-engagement' );

	if ( 0 === videoIds.length ) {
		return null;
	}

	const fetchVideoData = async ( videoId, videoAttachmentId, siteUrl ) => {
		const queryParams = {
			site_url: siteUrl,
			video_id: videoAttachmentId,
		};
		return await apiFetch( { path: addQueryArgs( '/godam/v1/engagement/activities', queryParams ) } ).then( ( response ) => {
			return {
				videoId,
				...response,
			};
		} );
	};

	const promises = [];

	videoIds.forEach( ( item ) => {
		const videoId = item.getAttribute( 'data-engagement-id' );
		const videoAttachmentId = item.getAttribute( 'data-engagement-video-id' );
		const siteUrl = item.getAttribute( 'data-engagement-site-url' );

		const likeLink = item.querySelector( '.rtgodam-video-engagement--like-link' );
		const commentLink = item.querySelector( '.rtgodam-video-engagement--like-comment' );

		if ( likeLink ) {
			likeLink.addEventListener( 'click', () => {
				store.dispatch.userLiked( videoId );
			} );
		}

		promises.push( fetchVideoData( videoId, videoAttachmentId, siteUrl ) );
	} );

	const results = await Promise.all( promises );
	collections.push( ...results );
	return collections;
};

const processEngagements = ( collections ) => {
	const engagementLikesData = {};
	const engagementViewsData = {};
	collections.forEach( ( item ) => {
		engagementLikesData[ item.videoId ] = item.data.likes_count;
		engagementViewsData[ item.videoId ] = item.data.views_count;
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
			case ACTIONS.USER_LIKED:
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
		userLiked: () => {
			return {
				type: ACTIONS.USER_LIKED,
			};
		},
		userCanceledLiked: () => {
			return {
				type: ACTIONS.USER_CANCELED_LIKED,
			};
		},
		userShared: () => {
			return {
				type: ACTIONS.USER_VIEWED,
			};
		},

		loadDefaultData: async ( storeObj ) => {
			const collections = await getVideoEngagementData( storeObj );
			return {
				type: ACTIONS.LOAD_VIDEO_ENGAGEMENT_DATA,
				collections,
			};
		},
	},

	selectors: {
		getState: ( state ) => state,
	},

	store() {
		return createReduxStore( 'godam-video-engagement', {
			reducer: this.reducer,
			actions: this.actions,
			selectors: this.selectors,
		} );
	},

	watch() {
		const state = this.select.getState();

		// eslint-disable-next-line no-console
		console.log( 'State:', state );
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
