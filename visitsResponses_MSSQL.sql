/***********************************/
/**
/**		Example MS SQL table creation
/**		for POPCheck lambda function
/**
/***********************************/

/* Visits */
CREATE TABLE [dbo].[Visits] (
	[id] int IDENTITY,
	[uuid] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[reference] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[locationName] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[locationReference] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[locationUUID] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[campaignName] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[campaignReference] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[campaignUUID] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[clientName] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[clientReference] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[clientUUID] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[userName] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[userUUID] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[scheduleStartDate] datetime NULL,
	[scheduleEndDate] datetime NULL,
	[actualStartDate] datetime NULL,
	[actualEndDate] datetime NULL,

	[startLat] float(53) NULL,
	[startLng] float(53) NULL,
	[startAccuracy] int NULL,

	[endLat] float(53) NULL,
	[endLng] float(53) NULL,
	[endAccuracy] int NULL,

	[createdAt] datetime NOT NULL DEFAULT (GETDATE())
)
ALTER TABLE [dbo].[Visits] ADD CONSTRAINT PK_Visits PRIMARY KEY(id)

/* Responses */
CREATE TABLE [dbo].[Responses] (
	[id] int IDENTITY,
	[visitId] int,

	[visitUUID] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[surveySectionReference] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[surveySectionName] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[surveySectionSortOrder] int NULL,

	[surveyQuestionReference] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[surveyQuestionType] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[surveyQuestionSortOrder] int NULL,
	[surveyQuestion] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[answer] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[createdAt] datetime NOT NULL DEFAULT (GETDATE())
)
ALTER TABLE [dbo].[Responses] ADD CONSTRAINT PK_Responses PRIMARY KEY(id)

/* Photos */
CREATE TABLE [dbo].[Photos] (
	[id] int IDENTITY,
	[visitId] int,

	[visitUUID] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[photoTagReference] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[photoTagName] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,
	[photoTagPrefix] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[url] nvarchar(250) COLLATE SQL_Latin1_General_CP1_CI_AS NULL,

	[lat] float(53) NULL,
	[lng] float(53) NULL,
	[accuracy] int NULL,

	[createdAt] datetime NOT NULL DEFAULT (GETDATE())
)
ALTER TABLE [dbo].[Photos] ADD CONSTRAINT PK_Photos PRIMARY KEY(id)
