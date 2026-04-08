import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from  "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;
  console.log("email :", email);

  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All the fields are requierd ");
  }
  const existUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existUser) {
    throw new ApiError(409, " User with email or username already exist");
  }
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, " Avatar file is required ");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!(username || email) || !password) {
    throw new ApiError(400, "Username or email and password are required");
  }

  const user = await User.findOne({
    $or: [
      { username: username?.toLowerCase() },
      { email: email?.toLowerCase() },
    ],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordVaild = await user.isPasswordCorrect(password);
  if (!isPasswordVaild) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!loggedInUser) {
    throw new ApiError(500, "Something went wrong while logging in");
  }

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "user logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) =>{
  const incomingRefreahToken = req.cookies.refreshToken || req.body.refreshToken
   if(!incomingRefreahToken){
    throw new ApiError(401 ,"unauthorized request")
   }
   try {
    const decodedToken = jwt.verify(incomingRefreahToken , process.env.REFRESH_TOKEN_SECRET)
    const user = User.findById(decodedToken?._id)
 
    if(!user){
     throw new ApiError(401 ,"invalid refresh token")
    }
 
    if(incomingRefreahToken !== user?.refreshToken){
     throw new ApiError(401 , " Refresh token is expired or used")
    }
 
    const options = {
     httpOnly:true,
     secure:true
    }
    const (accessToken ,newRefreshToken) =
    await generateAccessAndRefreshTokens(user._id)
    return res.status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken", newRefreshToke , options)
    .json(
     new ApiResponse(200 , {accessToken ,refreshToken: newRefreshToke},
       "access token refreshed"
     )
    )
   } catch (error) {
    throw new ApiError(401 ,error?.message || "invalid refersh token")
   }
})

const changeCurrentPassword = asyncHandler(async(req , res) =>{
   const{oldPassword , newPassword} = req.body
  
  const user = await User.findById(req.user?._id) 
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if(!isPasswordCorrect){
    throw new ApiError(400  , "Invalid old password")
  }

  user.password = newPassword
  await user.save({validateBeforeSave : false})

  return res
  .status(200)
  .json(new ApiResponse(200 , {} ,"Password changed successfully"))
})

const getCurrentUser = asyncHandler(async(req ,res ) =>{
    return res
    .status(200)
    .json(200, req.user ,"current user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req, res) => {
  const {fullname , email} = req.body

  if(!fullname || !email){
      throw new ApiError(400 ,"All fields are required")
  }

  const user = User.findByIdAndUpdate(
      req.user?._id,
      {
        $set:{
          fullname:fullname,
          email:email
        }
      }
  ).select("-password")
  
  return res
    .status(200)
    .json( new ApiResponse(200, user ,"Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req , res) =>{
  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath) {
    throw new ApiError(400 ,"Avatar file is missing")
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath)

  if(!avatar.url){
    throw new ApiError(400 , "Error while uploading on avatar")
  }

  await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        avatar: avatar.url
      
      }
    },{new:true}
  ).select("-password")

   return res
    .status(200)
    .json( new ApiResponse(200, user ,"Avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async(req , res) =>{
  const CoverImageLocalPath = req.file?.path

  if(!CoverImageLocalPath) {
    throw new ApiError(400 ,"CoverImage file is missing")
  }
  const CoverImage = await uploadOnCloudinary(CoverImageLocalPath)

  if(!CoverImage.url){
    throw new ApiError(400 , "Error while uploading on CoverImage")
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set:{
        CoverImage: CoverImage.url
      
      }
    },{new:true}
  ).select("-password")

  return res
    .status(200)
    .json( new ApiResponse(200, user ,"CoverImage updated successfully"))
})

export {
    registerUser,
    loginUser,
    logoutUser ,
    refreshAccessToken ,
    changeCurrentPassword ,
    getCurrentUser ,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
  };
