import React, {useEffect, useState} from 'react';
import {GoogleGenerativeAI} from '@google/generative-ai';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
// import ImagePicker from 'react-native-image-crop-picker';
import DocumentScanner from 'react-native-document-scanner-plugin';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import {API_KEY} from '@env';

const App = () => {
  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({model: 'gemini-1.5-flash'});
  const [imageUri, setImageUri] = useState(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // const pickImage = async () => {
  //   ImagePicker.openPicker({
  //     cropping: true,
  //   }).then(image => {
  //     setImageUri(image.path);
  //   });
  // };

  const openCamera = async () => {
    // ImagePicker.openCamera({
    //   cropping: true,
    // }).then(image => {
    //   setImageUri(image.path);
    // });
    const {scannedImages} = await DocumentScanner.scanDocument();
    if (scannedImages.length > 0) {
      // set the img src, so we can view the first scanned image
      setImageUri(scannedImages[0]);
      console.log(scannedImages);
    }
  };

  const recognizeText = async () => {
    if (imageUri) {
      setIsLoading(true);
      try {
        // const result = await model.generateContent([
        //   'extract table data from the image',
        //   imageUri,
        // ]);
        const result = await TextRecognition.recognize(imageUri);
        // setRecognizedText(result.text);
        const prompt = 'give formatted text in json format';
        const Gresult = await model.generateContent([prompt, result.text]);
        const response = await Gresult.response;
        const text = response.text();
        console.log(text);
        setRecognizedText(text);
      } catch (error) {
        console.error(error);
        setRecognizedText('Error extracting text');
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (imageUri) {
      recognizeText();
    }
  }, [imageUri]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <View style={styles.contentContainer}>
          <View style={styles.buttonContainer}>
            {/* <Button onPress={pickImage} title="Pick Image" /> */}
            <Button onPress={openCamera} title="Open Camera" />
          </View>
          {isLoading ? (
            <ActivityIndicator size="large" color="#0000ff" />
          ) : (
            <Text style={styles.recognizedText}>{recognizedText}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 64,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  recognizedText: {
    textAlign: 'justify',
    fontSize: 10,
  },
});

export default App;
