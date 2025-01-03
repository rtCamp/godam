/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

const slice = createSlice( {
	name: 'storage',
	initialState: {
		aws: {
			accessKey: '',
			secretKey: '',
			bucket: '',
		},
		offLoadMedia: false,
		bucketPath: 'wp-content/uploads',

		notice: {
			type: '',
			message: '',
		},

		shouldRefetch: false,

		validation: {
			isValid: false,
			errorMessage: '',
		},
	},
	reducers: {
		setSettings( state, action ) {
			state.offLoadMedia = action.payload.offLoadMedia ?? false;
			state.bucketPath = action.payload.bucketPath ?? 'wp-content/uploads';

			state.aws.accessKey = action.payload.aws?.accessKey ?? '';
			state.aws.secretKey = action.payload.aws?.secretKey ?? '';
			state.aws.bucket = action.payload.aws?.bucket ?? '';
		},
		setAWSAccessKey( state, action ) {
			state.aws.accessKey = action.payload;
		},
		setAWSSecretKey( state, action ) {
			state.aws.secretKey = action.payload;
		},
		setAWSBucket( state, action ) {
			state.aws.bucket = action.payload;
		},
		setOffLoadMedia( state, action ) {
			state.offLoadMedia = action.payload;
		},
		setRemoveLocalMedia( state, action ) {
			state.removeLocalMedia = action.payload;
		},
		setBucketPath( state, action ) {
			state.bucketPath = action.payload;
		},
		setNotice( state, action ) {
			state.notice = action.payload;
		},
		setValidation( state, action ) {
			state.validation = action.payload;
		},
		triggerRefresh( state ) {
			state.shouldRefetch = ! state.shouldRefetch;
		},
	},
} );

export const {
	setSettings,
	setAWSAccessKey,
	setAWSSecretKey,
	setAWSBucket,
	setOffLoadMedia,
	setBucketPath,
	setNotice,
	setValidation,
	triggerRefresh,
} = slice.actions;

export default slice.reducer;
