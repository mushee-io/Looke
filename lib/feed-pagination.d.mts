export type FeedCursor={createdAt:string;id:string};
export function encodeFeedCursor(createdAt:string|Date,id:string):string;
export function decodeFeedCursor(token:unknown):FeedCursor;
