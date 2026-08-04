import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: false,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: false,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
export const friendsConfig: FriendLink[] = [
	{
		title: "开往",
		imgurl: "https://www.travellings.cn/assets/logo.gif",
		desc: "开往是一个友链接力项目，通过随机跳转的方式为独立站点引流，推动网络的开放与多元，目前已有 1k+ 网站加入。",
		siteurl: "https://www.travellings.cn/go.html",
		tags: [],
		weight: 10, // 权重，数字越大排序越靠前
		enabled: true, // 是否启用
	},
];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
