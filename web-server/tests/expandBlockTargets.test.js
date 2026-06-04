const { expandBlockTargets } = require("../src/expandBlockTargets");

describe("expandBlockTargets", () => {
    it("expands an Android Instagram package to desktop domains", () => {
        expect(expandBlockTargets({
            appsBlocked: ["com.instagram.android"]
        })).toEqual({
            canonicalTargets: ["instagram"],
            appsBlocked: ["com.instagram.android"],
            domainsBlocked: ["instagram.com", "www.instagram.com"],
            processTokens: ["instagram"]
        });
    });

    it("expands a desktop website to Android packages", () => {
        expect(expandBlockTargets({
            domainsBlocked: ["https://www.x.com/home"]
        })).toEqual({
            canonicalTargets: ["x"],
            appsBlocked: ["com.twitter.android"],
            domainsBlocked: ["twitter.com", "www.twitter.com", "www.x.com", "x.com"],
            processTokens: ["tweetdeck", "twitter", "x"]
        });
    });

    it("keeps unknown domains on desktop only", () => {
        expect(expandBlockTargets({
            domainsBlocked: ["https://www.random.foo/path"]
        })).toEqual({
            canonicalTargets: [],
            appsBlocked: [],
            domainsBlocked: ["random.foo"],
            processTokens: []
        });
    });

    it("keeps unknown packages on Android only", () => {
        expect(expandBlockTargets({
            appsBlocked: ["com.unknown.app"]
        })).toEqual({
            canonicalTargets: [],
            appsBlocked: ["com.unknown.app"],
            domainsBlocked: [],
            processTokens: []
        });
    });
});
