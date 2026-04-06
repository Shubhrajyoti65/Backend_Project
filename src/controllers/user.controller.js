import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async(userId){
  try{
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken =  user.generateRefreshToken()

    user.refreshToken = refreshToken;
    await user.save({validateBeforeSave : false}) 

    return {accessToken , refreshToken}

  }catch(error){
    throw new ApiError(500 , "something went wrong while generating refresh and access token")
  }
}

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


const loginUser  = asyncHandler(async (req , res) => {
  const {email, username ,password} = req.body
  if(!username || !email) {
    throw new ApiError(400 , " username or password is required")
  }
  const user = await User.findOne({
    $or:[{username} , {email}]
  })
  if(!user){
    throw new ApiError(404, "User does not exist")
  }

  const isPasswordVaild = await user.isPasswordCorrect(password)
  if(!isPasswordVaild){
    throw new ApiError(401, "Invalid user credentials")
  }

  const {accessToken , refreshToken} = await generateAccessAndRefreshTokens(user._id)

const loggedInUser = user.findById(user._id).select("-password -refreshToken")

const options= {
  httpOnly : true,
  secure : true
}
return res
.status(200)
.cookie("accessToken" , accessToken , options)
.cookie("refreshToken" , refreshToken , options)
.json(
  new ApiResponse(
    200,
    {
      user: loggedInUser , accessToken,
      refreshToken
    },
    "user logged in successfully"
  )
)
})

const logoutUser  = asyncHandler(async(req , res) => {
    await User.findByIdAndUpdate(
      req.user._id,
      {
          $set :{
              refreshToken : undefined
          }
      },{
        new: true
      }
    )
    const options= {
    httpOnly : true,
    secure : true
}
return res
.status(200)
.clearCookie("accessToken" , options)
.clearCookie("refreshToken" , options)
.json(new ApiResponse(200 , {}, "user logged out"))
})


export {
  registerUser,
  loginUser,
  logoutUser
};
